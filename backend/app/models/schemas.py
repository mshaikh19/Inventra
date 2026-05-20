from enum import Enum
from typing import Optional
from pydantic import BaseModel, EmailStr, Field

class UserRole(str, Enum):
    SMALL = "small"
    MEDIUM = "medium"
    ENTERPRISE = "enterprise"


class UserBase(BaseModel):
    email: EmailStr
    firstName: str
    lastName: str
    businessName: str
    role: UserRole = UserRole.SMALL


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserResponse(UserBase):
    id: Optional[str] = Field(None, alias="_id")

    class Config:
        populate_by_name = True
