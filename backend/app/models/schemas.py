from enum import Enum
from typing import Optional, List, Dict
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


# Enums
class BusinessSize(str, Enum):
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"


class TokenPurpose(str, Enum):
    VERIFY_EMAIL = "verify_email"
    RESET_PASSWORD = "reset_password"


# User models
class UserBase(BaseModel):
    email: EmailStr
    firstName: str
    lastName: str
    businessName: str


class BusinessMetrics(BaseModel):
    """Ordinal answers from the guided Step-2 question set (all optional except locations & bizType)."""
    scale:      Optional[int] = None   # Q1: 0=just me, 1=2-10, 2=11-50, 3=50+
    volume:     Optional[int] = None   # Q2: 0=few, 1=moderate, 2=busy, 3=very high
    complexity: Optional[int] = None   # Q3: 0=<50 SKUs, 1=50-500, 2=500-5k, 3=5k+
    locations:  int = 0                # Q4: 0=1 store, 1=2-5, 2=6-20, 3=20+
    bizType:    str = "other"          # Q5: retail|grocery|pharmacy|apparel|other


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    # Optional business onboarding metrics
    inventorySize: Optional[int] = 0
    transactionsLast30d: Optional[int] = 0
    branches: Optional[int] = 1
    employees: Optional[int] = 1
    businessType: Optional[str] = None
    classification: Optional[BusinessSize] = BusinessSize.SMALL
    businessMetrics: Optional[BusinessMetrics] = None


class UserResponse(UserBase):
    id: Optional[str] = Field(None, alias="_id")
    businessTier:    Optional[str] = None    # ML-classified tier returned on signup
    mlConfidence:    Optional[float] = None
    signalQuality:   Optional[float] = None

    class Config:
        populate_by_name = True


# Internal DB model for users (stored in MongoDB)
class UserInDB(UserBase):
    hashedPassword: str
    isActive: bool = True
    isVerified: bool = False
    roles: List[str] = []
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: Optional[datetime] = None
    lastLogin: Optional[datetime] = None

    class Config:
        orm_mode = True


# JWT / Token models
class TokenData(BaseModel):
    userId: Optional[str] = None
    expiresAt: Optional[int] = None


class TokenResponse(BaseModel):
    accessToken: str
    refreshToken: Optional[str] = None
    tokenType: str = "bearer"
    expiresIn: Optional[int] = None


# Auth token document for email verification / password resets
class AuthToken(BaseModel):
    token: str
    userId: str
    purpose: TokenPurpose
    expiresAt: datetime
    used: bool = False
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        orm_mode = True


# ── ML Classification models ─────────────────────────────────────────────────
class ClassifyRequest(BaseModel):
    """Ordinal feature vector sent to the ML classify endpoint."""
    scale:      Optional[int] = None   # Q1: 0-3 or null (Not sure)
    volume:     Optional[int] = None   # Q2: 0-3 or null
    complexity: Optional[int] = None   # Q3: 0-3 or null
    locations:  int = 0                # Q4: 0-3 (required)
    bizType:    str = "other"          # Q5: retail|grocery|pharmacy|apparel|other (required)


class ClassifyResponse(BaseModel):
    """ML classification result returned to the frontend."""
    classification: BusinessSize
    confidence:     float              # model probability of top class (0-1)
    signalQuality:  float              # fraction of non-null features (0-1)
    probabilities:  Dict[str, float]   # per-class probabilities
    message:        str                # human-readable confidence message


# Business model (single unified model for create, response and DB storage)
class Business(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    ownerUserId: Optional[str] = None
    # Raw ordinal signals (from guided questions)
    scale:      Optional[int] = None
    volume:     Optional[int] = None
    complexity: Optional[int] = None
    locations:  Optional[int] = 0
    bizType:    Optional[str] = None
    # ML classification result
    classification:  BusinessSize = BusinessSize.SMALL
    mlConfidence:    Optional[float] = None
    signalQuality:   Optional[float] = None
    classifiedAt:    Optional[datetime] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: Optional[datetime] = None

    class Config:
        populate_by_name = True
        orm_mode = True


# Recommended MongoDB collection & index notes (camelCase fields)
# collections:
# - users
# - businesses
# - authTokens
#
# suggested indexes (run during DB migration/setup):
# db.users.createIndex({ email: 1 }, { unique: true })
# db.businesses.createIndex({ ownerUserId: 1 })
# db.authTokens.createIndex({ token: 1 })
# db.authTokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })

