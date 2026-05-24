from fastapi import APIRouter, HTTPException, status, Depends, Header
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from app.models import schemas
from app.database.mongo import getDatabase
from app.utils import security

router = APIRouter()


# ── Auth helper ──────────────────────────────────────────────────────────────
async def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    """Extract and validate bearer token, return user_id string."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header"
        )
    token = authorization.split(" ", 1)[1]
    try:
        payload = security.decodeToken(token)
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
    business = await db.businesses.find_one({"ownerUserId": user_id})
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No business found for this user. Complete business registration first."
        )
    return str(business["_id"])


def _serialize_branch(doc: dict) -> dict:
    """Convert a MongoDB document into a safe serializable dict."""
    if doc is None:
        return {}
    doc = dict(doc)
    doc["_id"] = str(doc["_id"]) if "_id" in doc else None
    # Serialize date objects to ISO strings
    if "opening_date" in doc and doc["opening_date"] is not None:
        if hasattr(doc["opening_date"], "isoformat"):
            doc["opening_date"] = doc["opening_date"].isoformat()
    if "created_at" in doc and doc["created_at"] is not None:
        if hasattr(doc["created_at"], "isoformat"):
            doc["created_at"] = doc["created_at"].isoformat()
    return doc


async def _generate_branch_id(db, business_id: str) -> str:
    """Auto-generate a sequential branch ID like BR001, BR002..."""
    count = await db.branches.count_documents({"business_id": business_id})
    return f"BR{str(count + 1).zfill(3)}"


async def _initialize_branch_inventory(db, business_id: str, branch_doc: dict) -> None:
    """Create an empty inventory record so new branches start with zero units."""
    iso_now = datetime.utcnow().isoformat() + "Z"
    branch_id = branch_doc["branch_id"]
    
    starter_items = [
        {
            "product_id": "PROD001",
            "product_name": "Amul Milk",
            "sku": "MILK001",
            "barcode": "8901234567890",
            "category": "Dairy",
            "subcategory": "Milk",
            "quantity": 0,
            "minimum_stock": 20,
            "maximum_stock": 500,
            "unit": "Packets",
            "purchase_price": 25.0,
            "selling_price": 30.0,
            "profit_margin": 5.0,
            "gst_percentage": 5.0,
            "batch_number": "BATCH102",
            "manufacturing_date": "2026-06-01",
            "expiry_date": "2026-06-20",
            "supplier_id": "SUP001",
            "supplier_name": "Amul Distributors",
            "branch_id": branch_id,
            "warehouse_id": "WH001",
            "predicted_demand": 200.0,
            "reorder_recommendation": True,
            "fast_moving": True,
            "seasonal_product": False,
            "total_sales": 0.0,
            "last_sold_date": "2026-06-15",
            "product_image": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=100&q=80",
            "created_at": iso_now,
            "updated_at": iso_now
        },
        {
            "product_id": "PROD002",
            "product_name": "Fresh Bread 400g",
            "sku": "BREAD001",
            "barcode": "8901234567891",
            "category": "Bakery",
            "subcategory": "Bread",
            "quantity": 0,
            "minimum_stock": 15,
            "maximum_stock": 300,
            "unit": "Loaves",
            "purchase_price": 32.0,
            "selling_price": 40.0,
            "profit_margin": 8.0,
            "gst_percentage": 0.0,
            "batch_number": "BATCH103",
            "manufacturing_date": "2026-06-01",
            "expiry_date": "2026-06-05",
            "supplier_id": "SUP002",
            "supplier_name": "Modern Bakeries",
            "branch_id": branch_id,
            "warehouse_id": "WH001",
            "predicted_demand": 150.0,
            "reorder_recommendation": True,
            "fast_moving": True,
            "seasonal_product": False,
            "total_sales": 0.0,
            "last_sold_date": "2026-06-15",
            "product_image": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=100&q=80",
            "created_at": iso_now,
            "updated_at": iso_now
        },
        {
            "product_id": "PROD003",
            "product_name": "Coke 500ml",
            "sku": "COKE001",
            "barcode": "8901234567892",
            "category": "Beverages",
            "subcategory": "Cold Drinks",
            "quantity": 0,
            "minimum_stock": 10,
            "maximum_stock": 1000,
            "unit": "Bottles",
            "purchase_price": 30.0,
            "selling_price": 40.0,
            "profit_margin": 10.0,
            "gst_percentage": 18.0,
            "batch_number": "BATCH104",
            "manufacturing_date": "2026-05-01",
            "expiry_date": "2026-11-01",
            "supplier_id": "SUP003",
            "supplier_name": "Hindustan Coca-Cola",
            "branch_id": branch_id,
            "warehouse_id": "WH001",
            "predicted_demand": 400.0,
            "reorder_recommendation": True,
            "fast_moving": True,
            "seasonal_product": True,
            "total_sales": 0.0,
            "last_sold_date": "2026-06-15",
            "product_image": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=100&q=80",
            "created_at": iso_now,
            "updated_at": iso_now
        }
    ]

    inventory_doc = {
        "business_id": business_id,
        "branch_id": branch_id,
        "branch_code": branch_doc["branch_code"],
        "branch_name": branch_doc["branch_name"],
        "items": starter_items,
        "total_units": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await db.inventories.insert_one(inventory_doc)


# ── CREATE ────────────────────────────────────────────────────────────────────
@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_branch(
    branch: schemas.BranchCreate,
    authorization: Optional[str] = Header(None)
):
    db = getDatabase()
    user_id = await get_current_user_id(authorization)
    business_id = await get_business_id(user_id, db)

    # Ensure branch_code is unique within this business
    existing = await db.branches.find_one({
        "business_id": business_id,
        "branch_code": branch.branch_code.upper()
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Branch code '{branch.branch_code}' already exists for this business."
        )

    branch_id = await _generate_branch_id(db, business_id)

    doc = branch.model_dump()
    doc["branch_id"]   = branch_id
    doc["business_id"] = business_id
    doc["branch_code"] = doc["branch_code"].upper()
    doc["branch_type"] = doc["branch_type"].value if hasattr(doc["branch_type"], "value") else doc["branch_type"]
    doc["status"]      = doc["status"].value if hasattr(doc["status"], "value") else doc["status"]
    doc["created_at"]  = datetime.utcnow()

    # Convert opening_date to a standard string if provided
    if doc.get("opening_date") and hasattr(doc["opening_date"], "isoformat"):
        doc["opening_date"] = doc["opening_date"].isoformat()

    result = await db.branches.insert_one(doc)
    doc["_id"] = str(result.inserted_id)

    await _initialize_branch_inventory(db, business_id, doc)

    return _serialize_branch(doc)


# ── LIST (all for this business) ──────────────────────────────────────────────
@router.get("/")
async def list_branches(authorization: Optional[str] = Header(None)):
    db = getDatabase()
    user_id = await get_current_user_id(authorization)
    business_id = await get_business_id(user_id, db)

    cursor = db.branches.find({"business_id": business_id, "status": {"$ne": "Inactive"}}).sort("branch_id", 1)
    branches = []
    async for doc in cursor:
        branches.append(_serialize_branch(doc))

    business = await db.businesses.find_one({"ownerUserId": user_id})
    expected_branches = int(business.get("branches") or 1) if business else 1
    expected_employees = int(business.get("employees") or 0) if business else 0

    return {
        "branches": branches,
        "total": len(branches),
        "expected_branches": expected_branches,
        "expected_employees": expected_employees
    }


# ── GET SINGLE ────────────────────────────────────────────────────────────────
@router.get("/{branch_id}")
async def get_branch(branch_id: str, authorization: Optional[str] = Header(None)):
    db = getDatabase()
    user_id = await get_current_user_id(authorization)
    business_id = await get_business_id(user_id, db)

    # Support lookup by MongoDB _id OR our branch_id code (e.g. "BR001")
    if ObjectId.is_valid(branch_id):
        doc = await db.branches.find_one({"_id": ObjectId(branch_id), "business_id": business_id})
    else:
        doc = await db.branches.find_one({"branch_id": branch_id, "business_id": business_id})

    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")

    return _serialize_branch(doc)


# ── UPDATE ────────────────────────────────────────────────────────────────────
@router.put("/{branch_id}")
async def update_branch(
    branch_id: str,
    updates: schemas.BranchUpdate,
    authorization: Optional[str] = Header(None)
):
    db = getDatabase()
    user_id = await get_current_user_id(authorization)
    business_id = await get_business_id(user_id, db)

    # Find the document
    if ObjectId.is_valid(branch_id):
        query = {"_id": ObjectId(branch_id), "business_id": business_id}
    else:
        query = {"branch_id": branch_id, "business_id": business_id}

    existing = await db.branches.find_one(query)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")

    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    # Serialize enums
    for f in ("branch_type", "status"):
        if f in update_data and hasattr(update_data[f], "value"):
            update_data[f] = update_data[f].value
    if "opening_date" in update_data and hasattr(update_data["opening_date"], "isoformat"):
        update_data["opening_date"] = update_data["opening_date"].isoformat()

    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.branches.update_one(query, {"$set": update_data})

    doc = await db.branches.find_one(query)
    return _serialize_branch(doc)


# ── DEACTIVATE (soft delete) ──────────────────────────────────────────────────
@router.delete("/{branch_id}")
async def deactivate_branch(branch_id: str, authorization: Optional[str] = Header(None)):
    db = getDatabase()
    user_id = await get_current_user_id(authorization)
    business_id = await get_business_id(user_id, db)

    if ObjectId.is_valid(branch_id):
        query = {"_id": ObjectId(branch_id), "business_id": business_id}
    else:
        query = {"branch_id": branch_id, "business_id": business_id}

    existing = await db.branches.find_one(query)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")

    await db.branches.update_one(query, {"$set": {"status": "Inactive", "deactivated_at": datetime.utcnow()}})
    return {"message": f"Branch {branch_id} deactivated successfully."}
