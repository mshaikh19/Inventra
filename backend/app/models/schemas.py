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


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserResponse(UserBase):
    id: Optional[str] = Field(None, alias="_id")
    businessTier:    Optional[str] = None    # ML-classified tier returned on signup
    dashboardPath:   Optional[str] = None
    mlConfidence:    Optional[float] = None
    signalQuality:   Optional[float] = None

    class Config:
        populate_by_name = True


class LoginResponse(BaseModel):
    message: str
    accessToken: str
    tokenType: str = "bearer"
    user: UserResponse


# ── ML Classification models ─────────────────────────────────────────────────
class ClassifyRequest(BaseModel):
    """Ordinal feature vector sent to the ML classify endpoint."""
    scale:      Optional[int] = None
    volume:     Optional[int] = None
    complexity: Optional[int] = None
    locations:  int = 0
    bizType:    str = "other"


class ClassifyResponse(BaseModel):
    """ML classification result returned to the frontend."""
    classification: BusinessSize
    confidence:     float
    signalQuality:  float
    probabilities:  Dict[str, float]
    message:        str


# Password reset models
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    newPassword: str = Field(..., min_length=6)


class ResetPasswordResponse(BaseModel):
    message: str
