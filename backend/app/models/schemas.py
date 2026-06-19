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
    """ Details needed for determining the business size and the type"""
    scale:      Optional[int] = None        # Q1: 0=just me, 1=2-10, 2=11-50, 3=50+
    volume:     Optional[int] = None        # Q2: 0=few, 1=moderate, 2=busy, 3=very high
    complexity: Optional[int] = None        # Q3: 0=<50 SKUs, 1=50-500, 2=500-5k, 3=5k+
    locations:  int = 0                     # Q4: 0=1 store, 1=2-5, 2=6-20, 3=20+
    businessType:    str = "other"          # Q5: retail|grocery|pharmacy|apparel|other


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

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


class GoogleLoginRequest(BaseModel):
    credential: Optional[str] = None
    access_token: Optional[str] = None
    businessName: Optional[str] = None
    businessType: Optional[str] = None
    inventorySize: Optional[int] = 0
    transactionsLast30d: Optional[int] = 0
    branches: Optional[int] = 1
    employees: Optional[int] = 1
    classification: Optional[str] = None


class UserResponse(UserBase):
    id: Optional[str] = Field(None, alias="_id")
    businessTier:    Optional[str] = None
    dashboardPath:   Optional[str] = None
    mlConfidence:    Optional[float] = None
    signalQuality:   Optional[float] = None
    role:            Optional[str] = "user"
    roles:           Optional[List[str]] = None
    branchId:        Optional[str] = None
    isActive:        Optional[bool] = True

    class Config:
        populate_by_name = True


class LoginResponse(BaseModel):
    message: str
    accessToken: str
    tokenType: str = "bearer"
    user: UserResponse


class EmployeeCreate(BaseModel):
    email: EmailStr
    firstName: str
    lastName: str
    password: str = Field(..., min_length=6)
    role: str = "employee"
    branchId: Optional[str] = None
    phone: Optional[str] = None


class EmployeeUpdate(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6)
    role: Optional[str] = None
    branchId: Optional[str] = None
    phone: Optional[str] = None
    isActive: Optional[bool] = None


class EmployeeResponse(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    email: EmailStr
    firstName: str
    lastName: str
    role: str
    branchId: Optional[str] = None
    phone: Optional[str] = None
    isActive: bool = True
    createdAt: Optional[datetime] = None

    class Config:
        populate_by_name = True

class ClassifyRequest(BaseModel):
    scale:      Optional[int] = None
    volume:     Optional[int] = None
    complexity: Optional[int] = None
    locations:  int = 0
    bizType:    str = "other"


class ClassifyResponse(BaseModel):
    classification: BusinessSize
    confidence:     float
    signalQuality:  float
    probabilities:  Dict[str, float]
    message:        str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    newPassword: str = Field(..., min_length=6)

class ResetPasswordResponse(BaseModel):
    message: str

# Notifications sent to the user
class NotificationType(str, Enum):
    LOW_STOCK = "low_stock"
    EXPIRY = "expiry"
    FESTIVAL = "festival"
    PAYMENT = "payment"
    REFUND = "refund"
    BRANCH = "branch"
    SYSTEM = "system"


class NotificationCreate(BaseModel):
    key: str
    type: NotificationType = NotificationType.SYSTEM
    title: str = ""
    text: str
    business_id: str
    branch_id: Optional[str] = None
    user_id: Optional[str] = None
    source: str = "system"
    is_read: bool = False
    meta: Optional[Dict] = None

class NotificationResponse(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    key: str
    type: NotificationType
    title: str = ""
    text: str
    business_id: str
    branch_id: Optional[str] = None
    user_id: Optional[str] = None
    source: str = "system"
    is_read: bool = False
    meta: Optional[Dict] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


# Branch Module
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
    manager_email:  Optional[EmailStr] = None
    manager_password: Optional[str] = Field(None, min_length=6)
    employee_count: int = Field(default=0, ge=0)
    working_hours:  str = Field(default="9AM-9PM")
    opening_date:   Optional[date] = None

    # Optional
    gstin:  Optional[str] = None
    status: BranchStatus = BranchStatus.ACTIVE


class BranchResponse(BaseModel):
    id:             Optional[str] = Field(None, alias="_id")
    branch_id:      str
    business_id:    str
    branch_name:    str
    branch_code:    str
    branch_type:    BranchType
    address:        str
    city:           str
    state:          str
    pincode:        str
    latitude:       Optional[float] = None
    longitude:      Optional[float] = None
    phone:          str
    manager_name:   str
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
    manager_email:  Optional[EmailStr]   = None
    manager_password: Optional[str]      = Field(None, min_length=6)
    employee_count: Optional[int]        = None
    working_hours:  Optional[str]        = None
    opening_date:   Optional[date]       = None
    gstin:          Optional[str]        = None
    status:         Optional[BranchStatus] = None

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
    mrp: Optional[float] = Field(default=None, ge=0)
    discount_percent: Optional[float] = Field(default=0, ge=0, le=100)
    sell_on_mrp: Optional[bool] = False
    profit_margin: Optional[float] = None
    gst_percentage: Optional[float] = None
    batch_number: Optional[str] = Field(default=None, max_length=80)
    manufacturing_date: Optional[date] = None
    expiry_date: Optional[date] = None
    supplier_id: Optional[str] = Field(default=None, max_length=80)
    supplier_name: Optional[str] = Field(default=None, max_length=200)
    warehouse_id: Optional[str] = Field(default=None, max_length=80)
    product_image: Optional[str] = None
    hsn_code: Optional[str] = None
    gst_rate: Optional[float] = None

    class Config:
        populate_by_name = True


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
    mrp: Optional[float] = Field(default=None, ge=0)
    discount_percent: Optional[float] = Field(default=None, ge=0, le=100)
    sell_on_mrp: Optional[bool] = None
    profit_margin: Optional[float] = None
    gst_percentage: Optional[float] = None
    batch_number: Optional[str] = Field(default=None, max_length=80)
    manufacturing_date: Optional[date] = None
    expiry_date: Optional[date] = None
    supplier_id: Optional[str] = Field(default=None, max_length=80)
    supplier_name: Optional[str] = Field(default=None, max_length=200)
    warehouse_id: Optional[str] = Field(default=None, max_length=80)
    product_image: Optional[str] = None
    hsn_code: Optional[str] = None
    gst_rate: Optional[float] = None

    class Config:
        populate_by_name = True


class InventoryItemResponse(InventoryItemBase):
    id: Optional[str] = Field(None, alias="_id")
    branch_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


class PaymentStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


class PaymentMethod(str, Enum):
    CARD = "card"
    NETBANKING = "netbanking"
    WALLET = "wallet"
    UPI = "upi"
    EMANDATE = "emandate"


class OrderItem(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    price: float
    gst_percentage: Optional[float] = 0.0
    hsn_code: Optional[str] = None
    gst_rate: Optional[float] = None
    total: float

    class Config:
        populate_by_name = True


class PaymentInitiateRequest(BaseModel):
    amount: float = Field(..., gt=0)
    description: str
    order_id: Optional[str] = None
    items: Optional[List[OrderItem]] = None
    customer_name: Optional[str] = None
    customer_email: str
    customer_phone: str
    branch_id: Optional[str] = None
    business_name: Optional[str] = None
    payment_mode: Optional[str] = None

    class Config:
        populate_by_name = True


class PaymentInitiateResponse(BaseModel):
    order_id: str
    razorpay_order_id: str
    key_id: str
    amount: float
    currency: str = "INR"
    timeout: int = 900

    class Config:
        populate_by_name = True


class PaymentVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    order_id: str

    class Config:
        populate_by_name = True


class PaymentVerifyResponse(BaseModel):
    success: bool
    message: str
    transaction_id: str
    amount: float
    payment_id: str

    class Config:
        populate_by_name = True


class TransactionRecord(BaseModel):
    transaction_id: str
    business_id: str
    branch_id: Optional[str] = None
    user_id: str
    razorpay_order_id: str
    razorpay_payment_id: Optional[str] = None
    amount: float     
    currency: str = "INR"
    status: PaymentStatus
    payment_method: Optional[PaymentMethod] = None
    items: Optional[List[OrderItem]] = None
    customer_name: Optional[str] = None
    customer_email: str
    customer_phone: str
    description: str
    receipt_number: Optional[str] = None
    invoice_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    refund_id: Optional[str] = None
    refund_amount: Optional[float] = None
    refund_reason: Optional[str] = None
    metadata: Optional[Dict] = None

    class Config:
        populate_by_name = True


class RefundRequest(BaseModel):
    transaction_id: str
    refund_amount: Optional[float] = None
    reason: str

    class Config:
        populate_by_name = True


class RefundResponse(BaseModel):
    success: bool
    message: str
    refund_id: Optional[str] = None
    refund_amount: Optional[float] = None

    class Config:
        populate_by_name = True


class InvoiceData(BaseModel):
    invoice_number: str
    business_name: str
    gstin: Optional[str] = None
    business_email: str
    customer_name: str
    customer_email: str
    customer_phone: str
    items: List[OrderItem]
    subtotal: float
    total_gst: float
    total_amount: float
    payment_method: str
    transaction_id: str
    invoice_date: datetime
    due_date: Optional[datetime] = None

    class Config:
        populate_by_name = True


# Task models
class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class TaskStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    role: str
    assigned_to: Optional[str] = None
    branch_id: str
    priority: TaskPriority = TaskPriority.MEDIUM


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    role: Optional[str] = None
    assigned_to: Optional[str] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None


class TaskResponse(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    title: str
    description: Optional[str] = None
    role: str
    assigned_to: Optional[str] = None
    branch_id: str
    business_id: str
    priority: TaskPriority
    status: TaskStatus
    assigned_by: str
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


