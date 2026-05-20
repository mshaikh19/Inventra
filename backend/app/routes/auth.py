from fastapi import APIRouter, HTTPException, status

from app.database.mongo import getDatabase
from app.models.schemas import LoginResponse, UserLogin, UserResponse
from app.utils.security import create_access_token, verify_password


router = APIRouter()


def _serialize_user(user_document: dict) -> UserResponse:
    return UserResponse.model_validate(
        {
            "_id": str(user_document.get("_id") or ""),
            "email": user_document.get("email"),
            "firstName": user_document.get("firstName"),
            "lastName": user_document.get("lastName"),
            "businessName": user_document.get("businessName"),
            "role": user_document.get("role"),
        }
    )


@router.post("/login", response_model=LoginResponse)
async def login(payload: UserLogin):
    database = getDatabase()
    if database is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not ready.",
        )

    users_collection = database["users"]
    normalized_email = payload.email.strip().lower()
    user_document = await users_collection.find_one({"email": normalized_email})

    if not user_document:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    stored_password = (
        user_document.get("passwordHash")
        or user_document.get("hashedPassword")
        or user_document.get("password")
    )

    if not stored_password or not verify_password(payload.password, stored_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    user = _serialize_user(user_document)
    access_token = create_access_token(
        {
            "sub": normalized_email,
            "user_id": user.id,
            "role": user.role,
        }
    )

    return LoginResponse(
        message="Login successful.",
        accessToken=access_token,
        user=user,
    )