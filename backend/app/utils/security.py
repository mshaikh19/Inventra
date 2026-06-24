import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from passlib.context import CryptContext
from jose import jwt

# Config via environment variables
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "525600"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "365"))

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def getPasswordHash(password: str) -> str:
    return pwd_context.hash(password)


def verifyPassword(plainPassword: str, hashedPassword: str) -> bool:
    return pwd_context.verify(plainPassword, hashedPassword)


def createAccessToken(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"sub": str(subject), "exp": int(expire.timestamp()), "iat": int(now.timestamp())}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def createRefreshToken(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {"sub": str(subject), "exp": int(expire.timestamp()), "iat": int(now.timestamp()), "type": "refresh"}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decodeToken(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def createPurposeToken(subject: str, purpose: str, expires_minutes: int = 60) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=expires_minutes)
    to_encode = {
        "sub": str(subject),
        "purpose": purpose,
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp()),
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


from fastapi import Header, HTTPException, status
from bson import ObjectId

def decodeTokenWithPurpose(token: str, expected_purpose: Optional[str] = None) -> dict:
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    if expected_purpose and payload.get("purpose") != expected_purpose:
        raise Exception("Invalid token purpose")
    return payload


async def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    """Extract and validate bearer token, return user_id string."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header"
        )
    token = authorization.split(" ", 1)[1]
    try:
        payload = decodeToken(token)
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("No subject in token")
        return user_id
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )


async def get_business_id(user_id: str, db) -> str:
    """Look up the business document for this user."""
    if ObjectId.is_valid(user_id):
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if user and "businessId" in user and user["businessId"]:
            return str(user["businessId"])
    business = await db.businesses.find_one({"ownerUserId": user_id})
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No business found for this user."
        )
    return str(business["_id"])
