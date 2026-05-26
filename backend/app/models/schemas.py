from enum import Enum
from typing import Optional, List, Dict
from datetime import datetime, date
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


# ── Branch Module ─────────────────────────────────────────────────────────────
class BranchType(str, Enum):
    STORE     = "Store"
    WAREHOUSE = "Warehouse"
    FRANCHISE = "Franchise"
    DEPOT     = "Depot"


class BranchStatus(str, Enum):
    ACTIVE   = "Active"
    INACTIVE = "Inactive"


class BranchCreate(BaseModel):
    # Basic info
    branch_name: str = Field(..., min_length=2, max_length=100)
    branch_code: str = Field(..., min_length=2, max_length=20)
    branch_type: BranchType = BranchType.STORE

    # Location
    address:  str = Field(..., min_length=5)
    city:     str = Field(..., min_length=2)
    state:    str = Field(..., min_length=2)
    pincode:  str = Field(..., min_length=4, max_length=10)
    latitude:  Optional[float] = None
    longitude: Optional[float] = None

    # Contact & operations
    phone:          str = Field(..., min_length=7)
    manager_name:   str = Field(..., min_length=2)
    employee_count: int = Field(default=1, ge=1)
    working_hours:  str = Field(default="9AM-9PM")
    opening_date:   Optional[date] = None

    # Optional
    gstin:  Optional[str] = None
    status: BranchStatus = BranchStatus.ACTIVE


class BranchResponse(BaseModel):
    id:           Optional[str] = Field(None, alias="_id")
    branch_id:    str           # e.g. "BR001"
    business_id:  str
    branch_name:  str
    branch_code:  str
    branch_type:  BranchType
    address:      str
    city:         str
    state:        str
    pincode:      str
    latitude:     Optional[float] = None
    longitude:    Optional[float] = None
    phone:        str
    manager_name: str
    employee_count: int
    working_hours:  str
    opening_date:   Optional[date] = None
    gstin:          Optional[str]  = None
    status:         BranchStatus
    created_at:     Optional[datetime] = None

    class Config:
        populate_by_name = True


class BranchUpdate(BaseModel):
    branch_name:    Optional[str]        = None
    branch_code:    Optional[str]        = None
    branch_type:    Optional[BranchType] = None
    address:        Optional[str]        = None
    city:           Optional[str]        = None
    state:          Optional[str]        = None
    country:        Optional[str]        = None
    pincode:        Optional[str]        = None
    latitude:       Optional[float]      = None
    longitude:      Optional[float]      = None
    phone:          Optional[str]        = None
    manager_name:   Optional[str]        = None
    employee_count: Optional[int]        = None
    working_hours:  Optional[str]        = None
    opening_date:   Optional[date]       = None
    gstin:          Optional[str]        = None
    status:         Optional[BranchStatus] = None


# ── Inventory Module ─────────────────────────────────────────────────────────
class InventoryItemBase(BaseModel):
    product_name: str = Field(..., min_length=1, max_length=200)
    category: str = Field(default="Uncategorized", min_length=1, max_length=100)
    sku: Optional[str] = Field(default=None, max_length=80)
    barcode: Optional[str] = Field(default=None, max_length=80)
    quantity: int = Field(default=0, ge=0)
    minimum_stock: int = Field(default=0, ge=0)
    maximum_stock: Optional[int] = Field(default=None, ge=0)
    unit: Optional[str] = Field(default=None, max_length=30)
    purchase_price: Optional[float] = Field(default=None, ge=0)
    selling_price: Optional[float] = Field(default=None, ge=0)
    profit_margin: Optional[float] = None
    gst_percentage: Optional[float] = None
    batch_number: Optional[str] = Field(default=None, max_length=80)
    manufacturing_date: Optional[date] = None
    expiry_date: Optional[date] = None
    supplier_id: Optional[str] = Field(default=None, max_length=80)
    supplier_name: Optional[str] = Field(default=None, max_length=200)
    warehouse_id: Optional[str] = Field(default=None, max_length=80)
    product_image: Optional[str] = None


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItemUpdate(BaseModel):
    product_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    category: Optional[str] = Field(default=None, min_length=1, max_length=100)
    sku: Optional[str] = Field(default=None, max_length=80)
    barcode: Optional[str] = Field(default=None, max_length=80)
    quantity: Optional[int] = Field(default=None, ge=0)
    minimum_stock: Optional[int] = Field(default=None, ge=0)
    maximum_stock: Optional[int] = Field(default=None, ge=0)
    unit: Optional[str] = Field(default=None, max_length=30)
    purchase_price: Optional[float] = Field(default=None, ge=0)
    selling_price: Optional[float] = Field(default=None, ge=0)
    profit_margin: Optional[float] = None
    gst_percentage: Optional[float] = None
    batch_number: Optional[str] = Field(default=None, max_length=80)
    manufacturing_date: Optional[date] = None
    expiry_date: Optional[date] = None
    supplier_id: Optional[str] = Field(default=None, max_length=80)
    supplier_name: Optional[str] = Field(default=None, max_length=200)
    warehouse_id: Optional[str] = Field(default=None, max_length=80)
    product_image: Optional[str] = None


class InventoryItemResponse(InventoryItemBase):
    id: Optional[str] = Field(None, alias="_id")
    branch_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
