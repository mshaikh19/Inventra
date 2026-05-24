from fastapi import APIRouter, HTTPException, status, Depends
from app.models import schemas
from app.database.mongo import getDatabase
from app.utils import security
from datetime import timedelta
from pydantic import EmailStr
from datetime import datetime
from app.services.ml_classifier import classifier
from app.services.dashboard_profiles import normalize_business_tier
from bson import ObjectId

router = APIRouter()


@router.post("/signup", response_model=schemas.LoginResponse)
async def signUp(user: schemas.UserCreate):
    db = getDatabase()
    # check existing
    existing = await db.users.find_one({"email": user.email})
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
        "roles": ["user"],
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
                    # fallback lightweight weighted scoring
                    score = 0
                    score += min(business_doc["employees"], 200) * 0.002
                    score += min(business_doc["branches"], 50) * 0.02
                    score += MathSafeLog(business_doc["transactionsLast30d"]) * 0.6
                    score += MathSafeLog(business_doc["inventorySize"]) * 0.4
                    if score > 12:
                        business_doc["classification"] = "large"
                    elif score > 6:
                        business_doc["classification"] = "medium"
                    else:
                        business_doc["classification"] = "small"

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

    access_token = security.createAccessToken(str(existing.get("_id")))
    user_response = {
        "_id": str(existing.get("_id")),
        "email": existing.get("email"),
        "firstName": existing.get("firstName"),
        "lastName": existing.get("lastName"),
        "businessName": existing.get("businessName"),
        "businessTier": normalize_business_tier(existing.get("businessTier") or existing.get("classification")),
        "dashboardPath": f"/dashboard/{normalize_business_tier(existing.get('businessTier') or existing.get('classification'))}",
        "mlConfidence": existing.get("mlConfidence"),
        "signalQuality": existing.get("signalQuality"),
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
    user = await db.users.find_one({"email": email})
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


# Note: login endpoint intentionally omitted per request; implement separately when needed.
