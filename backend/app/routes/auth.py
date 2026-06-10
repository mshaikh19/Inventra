from fastapi import APIRouter, HTTPException, status, Depends, Header
from app.models import schemas
from app.database.mongo import getDatabase
from app.utils import security
from datetime import timedelta
from pydantic import EmailStr, BaseModel
from datetime import datetime
from app.services.ml_classifier import classifier
from app.services.dashboard_profiles import normalize_business_tier
from bson import ObjectId
from typing import Optional

router = APIRouter()


@router.post("/signup", response_model=schemas.LoginResponse)
async def signUp(user: schemas.UserCreate):
    db = getDatabase()
    # check existing — skip soft-deleted accounts (their email is freed for re-signup)
    existing = await db.users.find_one({"email": user.email, "isDeleted": {"$ne": True}})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={
            "field": "email",
            "message": "Email already registered",
            "code": "email_taken"
        })

    hashed = security.getPasswordHash(user.password)
    user_doc = {
        "email": user.email,
        "firstName": user.firstName,
        "lastName": user.lastName,
        "businessName": user.businessName,
        "role": "owner",
        "roles": ["owner", "user"],
        "hashedPassword": hashed,
        "isActive": True,
        "isVerified": False,
    }
    resolved_tier = normalize_business_tier(user.classification)


    try:
        res = await db.users.insert_one(user_doc)
        user_doc["_id"] = str(res.inserted_id)

        # create business document if onboarding metrics provided
        try:
            business_doc = {
                "name": user.businessName,
                "ownerUserId": str(user_doc["_id"]),
                "inventorySize": int(user.inventorySize or 0),
                "transactionsLast30d": int(user.transactionsLast30d or 0),
                "branches": int(user.branches or 1),
                "employees": int(user.employees or 1),
                "businessType": user.businessType or None,
                # classification may be provided by frontend; otherwise compute server-side
                "classification": (user.classification.value if hasattr(user.classification, 'value') else user.classification) or None,
                "mlConfidence": float(user.mlConfidence) if hasattr(user, 'mlConfidence') and user.mlConfidence is not None else None,
                "signalQuality": float(user.signalQuality) if hasattr(user, 'signalQuality') and user.signalQuality is not None else None,
                "createdAt": datetime.utcnow()
            }

            # server-side classification: prefer ML classifier when available
            if not business_doc.get("classification"):
                try:
                    # map raw numeric signals into ordinal features expected by ML service
                    def to_ordinal(n, breaks):
                        try:
                            v = int(n or 0)
                        except Exception:
                            v = 0
                        for i, b in enumerate(breaks):
                            if v <= b:
                                return i
                        return len(breaks)

                    features = {
                        "scale": to_ordinal(business_doc.get("employees", 0), [10, 50, 100]),
                        "volume": to_ordinal(business_doc.get("transactionsLast30d", 0), [100, 1000, 10000]),
                        "complexity": to_ordinal(business_doc.get("inventorySize", 0), [1000, 5000, 15000]),
                        "locations": int(business_doc.get("branches", 0)),
                        "bizType": business_doc.get("businessType") or "other",
                    }

                    ml_result = classifier.predict(features)
                    business_doc["classification"] = ml_result.get("classification")
                    business_doc["mlConfidence"] = float(ml_result.get("confidence", 0))
                    business_doc["signalQuality"] = float(ml_result.get("signalQuality", 0))
                    business_doc["classifiedAt"] = datetime.utcnow()
                except Exception:
                    raise

            resolved_tier = normalize_business_tier(business_doc.get("classification") or resolved_tier)
            business_doc["classification"] = resolved_tier
            business_doc["dashboardPath"] = f"/dashboard/{resolved_tier}"
            user_doc["businessTier"] = resolved_tier
            user_doc["dashboardPath"] = business_doc["dashboardPath"]
            await db.users.update_one(
                {"_id": ObjectId(user_doc["_id"])},
                {"$set": {"businessTier": resolved_tier, "dashboardPath": business_doc["dashboardPath"]}},
            )

            bres = await db.businesses.insert_one(business_doc)
            business_doc["_id"] = str(bres.inserted_id)
        except Exception:
            # non-fatal: business persistence should not block user creation
            pass

        if "business_doc" not in locals():
            user_doc["businessTier"] = resolved_tier
            user_doc["dashboardPath"] = f"/dashboard/{resolved_tier}"

        # Attach ML results to returned user object when available
        if 'business_doc' in locals():
            user_doc["businessTier"] = business_doc.get("classification")
            user_doc["dashboardPath"] = business_doc.get("dashboardPath")
            user_doc["mlConfidence"] = business_doc.get("mlConfidence")
            user_doc["signalQuality"] = business_doc.get("signalQuality")

        access_token = security.createAccessToken(str(user_doc["_id"]))

        return {
            "message": "Signup successful.",
            "accessToken": access_token,
            "tokenType": "bearer",
            "user": user_doc,
        }
    except Exception as exc:
        # return a clear error to client
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={
            "message": "Unable to create user",
            "error": str(exc)
        })


@router.post("/login", response_model=schemas.LoginResponse)
async def login(user: schemas.UserLogin):
    db = getDatabase()
    existing = await db.users.find_one({"email": user.email})

    if not existing or not existing.get("hashedPassword"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not security.verifyPassword(user.password, existing["hashedPassword"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if existing.get("isDeleted", False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account has been deleted. Use the recovery link sent to your email to restore it, or sign up for a new account.",
        )

    if not existing.get("isActive", True):
        # Check if deactivated because owner deleted their account
        if existing.get("ownerDeleted", False):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Your access was revoked when the account owner deleted their account. You can sign up for a new account.",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your account has been deactivated. Contact your administrator.",
        )

    business = None
    business_id = existing.get("businessId")
    if business_id:
        business = await db.businesses.find_one({"_id": ObjectId(business_id)})
    else:
        business = await db.businesses.find_one({"ownerUserId": str(existing["_id"])})

    business_tier = "small"
    business_name = existing.get("businessName")
    if business:
        business_tier = normalize_business_tier(business.get("classification") or business.get("businessTier") or "small")
        if not business_name:
            business_name = business.get("name")

    existing_id = str(existing.get("_id"))
    existing_roles = existing.get("roles") or []
    is_business_owner = (
        (business and str(business.get("ownerUserId")) == existing_id)
        or existing.get("role") in ("owner", "user")
        or "owner" in existing_roles
    )

    access_token = security.createAccessToken(str(existing.get("_id")))
    user_response = {
        "_id": existing_id,
        "email": existing.get("email"),
        "firstName": existing.get("firstName"),
        "lastName": existing.get("lastName"),
        "businessName": business_name or "",
        "businessTier": business_tier,
        "dashboardPath": f"/dashboard/{business_tier}",
        "mlConfidence": existing.get("mlConfidence") or (business.get("mlConfidence") if business else None),
        "signalQuality": existing.get("signalQuality") or (business.get("signalQuality") if business else None),
        "role": "owner" if is_business_owner else (existing.get("role") or "employee"),
        "roles": ["owner", "user"] if is_business_owner else existing_roles,
        "branchId": existing.get("branchId"),
        "isActive": existing.get("isActive", True),
    }

    return {
        "message": "Login successful.",
        "accessToken": access_token,
        "tokenType": "bearer",
        "user": user_response,
    }

@router.get("/check-email")
async def checkEmail(email: EmailStr):
    db = getDatabase()
    # Only treat non-soft-deleted accounts (and non-ownerDeleted staff) as "existing"
    user = await db.users.find_one({
        "email": email,
        "isDeleted": {"$ne": True},
        "ownerDeleted": {"$ne": True},
    })
    return {"exists": user is not None}


@router.get("/debug/signup-status")
async def getSignupStatus(email: EmailStr):
    db = getDatabase()

    user = await db.users.find_one({"email": email})
    if not user:
        return {
            "email": email,
            "userExists": False,
            "businessExists": False,
        }

    business = await db.businesses.find_one({"ownerUserId": str(user.get("_id"))})

    return {
        "email": email,
        "userExists": True,
        "businessExists": business is not None,
        "userId": str(user.get("_id")),
        "businessId": str(business.get("_id")) if business else None,
        "businessName": business.get("name") if business else None,
        "classification": business.get("classification") if business else None,
    }


def MathSafeLog(x: int):
    # small utility to scale numeric values safely
    try:
        import math
        return math.log(max(1, int(x)))
    except Exception:
        return 0


@router.post("/forgot-password")
async def forgot_password(payload: schemas.ForgotPasswordRequest):
    db = getDatabase()
    # Always return success to avoid user enumeration
    user = await db.users.find_one({"email": payload.email})

    if not user:
        return {"message": "If an account exists for this email, a reset link was issued."}

    # create a short-lived reset token
    expires_minutes = 60
    token = security.createPurposeToken(str(user.get("_id")), schemas.TokenPurpose.RESET_PASSWORD.value, expires_minutes=expires_minutes)

    expires_at = datetime.utcnow() + timedelta(minutes=expires_minutes)

    await db.users.update_one({"_id": user.get("_id")}, {"$set": {"resetToken": token, "resetTokenExpires": expires_at}})

    # In dev return token so it can be used without email delivery. In prod this would be emailed.
    return {"message": "Reset token created.", "resetToken": token, "expiresAt": expires_at.isoformat()}


@router.post("/reset-password", response_model=schemas.ResetPasswordResponse)
async def reset_password(payload: schemas.ResetPasswordRequest):
    db = getDatabase()

    try:
        data = security.decodeTokenWithPurpose(payload.token, schemas.TokenPurpose.RESET_PASSWORD.value)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    sub = data.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token payload")

    try:
        user = await db.users.find_one({"_id": ObjectId(sub)})
    except Exception:
        user = None

    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token")

    # verify token matches stored token and not expired
    stored = user.get("resetToken")
    expires = user.get("resetTokenExpires")
    if not stored or stored != payload.token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token")

    if not expires or (isinstance(expires, datetime) and expires < datetime.utcnow()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token expired")

    # update password
    hashed = security.getPasswordHash(payload.newPassword)
    await db.users.update_one({"_id": user.get("_id")}, {"$set": {"hashedPassword": hashed}, "$unset": {"resetToken": "", "resetTokenExpires": ""}})

    return {"message": "Password updated successfully."}


class ProfileUpdateRequest(BaseModel):
    firstName: str
    lastName: str
    businessName: str
    email: str
    businessType: Optional[str] = None

@router.post("/update-profile")
async def update_profile(
    payload: ProfileUpdateRequest,
    authorization: Optional[str] = Header(None)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header"
        )
    token = authorization.split(" ", 1)[1]
    try:
        token_data = security.decodeToken(token)
        user_id = token_data.get("sub")
        if not user_id:
            raise ValueError()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    db = getDatabase()

    # Check if email is already taken by another user
    existing_other = await db.users.find_one({"email": payload.email, "_id": {"$ne": ObjectId(user_id)}})
    if existing_other:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered by another user"
        )

    # Update User document
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "firstName": payload.firstName,
            "lastName": payload.lastName,
            "businessName": payload.businessName,
            "email": payload.email
        }}
    )

    # Update or create Business document associated with this user
    business = await db.businesses.find_one({"ownerUserId": user_id})
    if business:
        await db.businesses.update_one(
            {"ownerUserId": user_id},
            {"$set": {
                "name": payload.businessName,
                "businessType": payload.businessType
            }}
        )
    else:
        await db.businesses.insert_one({
            "name": payload.businessName,
            "ownerUserId": user_id,
            "businessType": payload.businessType,
            "createdAt": datetime.utcnow()
        })

    # Load updated user response
    updated_user = await db.users.find_one({"_id": ObjectId(user_id)})
    updated_business = await db.businesses.find_one({"ownerUserId": user_id})

    # Resolve tier
    business_tier = "small"
    if updated_business:
        business_tier = normalize_business_tier(updated_business.get("classification") or "small")

    updated_user_roles = updated_user.get("roles") or []
    is_business_owner = (
        (updated_business and str(updated_business.get("ownerUserId")) == user_id)
        or updated_user.get("role") in ("owner", "user")
        or "owner" in updated_user_roles
    )

    user_response = {
        "_id": str(updated_user["_id"]),
        "email": updated_user["email"],
        "firstName": updated_user["firstName"],
        "lastName": updated_user["lastName"],
        "businessName": updated_user.get("businessName") or (updated_business.get("name") if updated_business else ""),
        "businessTier": business_tier,
        "businessType": updated_business.get("businessType") if updated_business else None,
        "dashboardPath": f"/dashboard/{business_tier}",
        "role": "owner" if is_business_owner else (updated_user.get("role") or "employee"),
        "roles": ["owner", "user"] if is_business_owner else updated_user_roles,
        "branchId": updated_user.get("branchId"),
        "isActive": updated_user.get("isActive", True),
    }

    return {
        "message": "Profile updated successfully.",
        "user": user_response
    }


# Note: login endpoint intentionally omitted per request; implement separately when needed.


@router.delete("/delete-account")
async def delete_account(
    authorization: Optional[str] = Header(None)
):
    """
    Soft-deletes the owner account:
      - Marks the owner as isDeleted=True, stores deletedAt timestamp.
      - Generates a recovery token valid for 30 days.
      - Marks all staff under this business as isActive=False, ownerDeleted=True.
    Data (business, branches, products) is preserved for the recovery window.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header"
        )
    token = authorization.split(" ", 1)[1]
    try:
        token_data = security.decodeToken(token)
        user_id = token_data.get("sub")
        if not user_id:
            raise ValueError("Missing sub in token")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    db = getDatabase()

    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = None

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found"
        )

    if user.get("isDeleted", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is already deleted."
        )

    # Generate a 30-day recovery token
    recovery_token = security.createPurposeToken(
        user_id,
        "account_recovery",
        expires_minutes=60 * 24 * 30  # 30 days
    )
    deleted_at = datetime.utcnow()

    try:
        # 1. Soft-delete the owner account
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                "isDeleted": True,
                "isActive": False,
                "deletedAt": deleted_at,
                "recoveryToken": recovery_token,
            }}
        )

        # 2. Lock all staff (non-owner) accounts under this business
        business = await db.businesses.find_one({"ownerUserId": user_id})
        if business:
            business_id = business["_id"]
            await db.users.update_many(
                {
                    "businessId": business_id,
                    "role": {"$ne": "owner"}
                },
                {"$set": {
                    "isActive": False,
                    "ownerDeleted": True,
                    "ownerDeletedAt": deleted_at,
                }}
            )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "Failed to delete account", "error": str(exc)}
        )

    return {
        "message": "Account soft-deleted. You have 30 days to recover it.",
        "recoveryToken": recovery_token,
    }


@router.post("/recover-account")
async def recover_account(payload: dict):
    """
    Reactivates a soft-deleted owner account using the recovery token.
    Also re-enables all staff accounts that were locked due to owner deletion.
    """
    recovery_token = payload.get("recoveryToken", "")
    if not recovery_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recovery token is required."
        )

    # Validate the recovery token
    try:
        data = security.decodeTokenWithPurpose(recovery_token, "account_recovery")
        user_id = data.get("sub")
        if not user_id:
            raise ValueError("Missing sub")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired recovery token. The 30-day recovery window may have passed."
        )

    db = getDatabase()

    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = None

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found."
        )

    if not user.get("isDeleted", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account is not in a deleted state."
        )

    # Verify the stored token matches
    if user.get("recoveryToken") != recovery_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recovery token does not match."
        )

    try:
        # 1. Restore the owner account
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                "isDeleted": False,
                "isActive": True,
            }, "$unset": {
                "deletedAt": "",
                "recoveryToken": "",
            }}
        )

        # 2. Re-enable all staff that were locked due to this owner's deletion
        business = await db.businesses.find_one({"ownerUserId": user_id})
        if business:
            await db.users.update_many(
                {"businessId": business["_id"], "ownerDeleted": True},
                {"$set": {"isActive": True}, "$unset": {"ownerDeleted": "", "ownerDeletedAt": ""}}
            )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "Recovery failed", "error": str(exc)}
        )

    # Issue a new login token so the user is immediately signed back in
    access_token = security.createAccessToken(user_id)
    business = await db.businesses.find_one({"ownerUserId": user_id})
    from app.services.dashboard_profiles import normalize_business_tier
    business_tier = "small"
    if business:
        business_tier = normalize_business_tier(business.get("classification") or "small")

    recovered_user = await db.users.find_one({"_id": ObjectId(user_id)})
    recovered_user_roles = recovered_user.get("roles") or []
    is_business_owner = (
        (business and str(business.get("ownerUserId")) == user_id)
        or recovered_user.get("role") in ("owner", "user")
        or "owner" in recovered_user_roles
    )
    user_response = {
        "_id": str(recovered_user["_id"]),
        "email": recovered_user["email"],
        "firstName": recovered_user["firstName"],
        "lastName": recovered_user["lastName"],
        "businessName": recovered_user.get("businessName", ""),
        "businessTier": business_tier,
        "dashboardPath": f"/dashboard/{business_tier}",
        "role": "owner" if is_business_owner else (recovered_user.get("role") or "employee"),
        "roles": ["owner", "user"] if is_business_owner else recovered_user_roles,
        "branchId": recovered_user.get("branchId"),
        "isActive": True,
    }

    return {
        "message": "Account recovered successfully. Welcome back!",
        "accessToken": access_token,
        "tokenType": "bearer",
        "user": user_response,
    }
