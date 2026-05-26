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
    """Create an empty inventory record so new branches start with zero items."""
    branch_id = branch_doc["branch_id"]
    inventory_doc = {
        "business_id": business_id,
        "branch_id": branch_id,
        "branch_code": branch_doc["branch_code"],
        "branch_name": branch_doc["branch_name"],
        "items": [],
        "total_units": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await db.inventories.insert_one(inventory_doc)


def _serialize_inventory_item(item: dict) -> dict:
    """Convert an inventory item into a JSON-safe dict."""
    if item is None:
        return {}

    doc = dict(item)
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])

    for field in ("created_at", "updated_at", "manufacturing_date", "expiry_date", "last_sold_date"):
        value = doc.get(field)
        if value is not None and hasattr(value, "isoformat"):
            doc[field] = value.isoformat()

    return doc


def _serialize_inventory_doc(doc: dict) -> dict:
    """Convert an inventory document into a JSON-safe dict."""
    if doc is None:
        return {}

    inventory = dict(doc)
    if "_id" in inventory:
        inventory["_id"] = str(inventory["_id"])
    if "branch_id" in inventory and inventory["branch_id"] is not None:
        inventory["branch_id"] = str(inventory["branch_id"])

    for field in ("created_at", "updated_at"):
        value = inventory.get(field)
        if value is not None and hasattr(value, "isoformat"):
            inventory[field] = value.isoformat()

    inventory["items"] = [
        _serialize_inventory_item(item)
        for item in (inventory.get("items") or [])
    ]
    inventory["total_items"] = len(inventory["items"])
    inventory["total_units"] = sum(int(item.get("quantity") or 0) for item in inventory["items"])
    return inventory


def _serialize_inventory_doc_safe(doc: dict) -> dict:
    inventory = _serialize_inventory_doc(doc)
    inventory["items"] = [_serialize_inventory_item_safe(item) for item in (doc.get("items") or [])]
    inventory["total_items"] = len(inventory["items"])
    inventory["total_units"] = sum(int(item.get("quantity") or item.get("stock") or 0) for item in inventory["items"])
    return inventory


def _serialize_inventory_item_safe(item: dict) -> dict:
    normalized = _serialize_inventory_item(item)
    if not normalized.get("_id"):
        fallback_id = item.get("_id") or item.get("product_id") or item.get("sku") or item.get("barcode")
        if fallback_id is not None:
            normalized["_id"] = str(fallback_id)
    return normalized


def _build_branch_query(branch_id: str, business_id: str) -> dict:
    if ObjectId.is_valid(branch_id):
        return {"_id": ObjectId(branch_id), "business_id": business_id}
    return {
        "business_id": business_id,
        "$or": [
            {"branch_id": branch_id},
            {"branch_name": branch_id},
        ],
    }


async def _get_branch_for_inventory(branch_id: str, business_id: str, db):
    branch = await db.branches.find_one(_build_branch_query(branch_id, business_id))
    if not branch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")
    return branch


def _ensure_item_ids(items: list) -> list:
    normalized_items = []
    for item in items or []:
        normalized = dict(item)
        item_id = normalized.get("_id") or normalized.get("product_id") or normalized.get("sku") or normalized.get("barcode") or str(ObjectId())
        normalized["_id"] = str(item_id)
        normalized_items.append(normalized)
    return normalized_items


def _normalize_inventory_value(value):
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def _normalize_inventory_payload(payload: dict) -> dict:
    data = {k: v for k, v in payload.items() if v is not None}
    for field in ("manufacturing_date", "expiry_date"):
        if field in data:
            data[field] = _normalize_inventory_value(data[field])
    return data


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


@router.get("/{branch_id}/inventory")
async def get_branch_inventory(branch_id: str, authorization: Optional[str] = Header(None)):
    db = getDatabase()
    user_id = await get_current_user_id(authorization)
    business_id = await get_business_id(user_id, db)

    branch = await _get_branch_for_inventory(branch_id, business_id, db)

    inventory = await db.inventories.find_one({"business_id": business_id, "branch_id": branch["branch_id"]})
    if not inventory:
        return {
            "branch": _serialize_branch(branch),
            "inventory": {
                "business_id": business_id,
                "branch_id": branch["branch_id"],
                "branch_code": branch.get("branch_code"),
                "branch_name": branch.get("branch_name"),
                "items": [],
                "total_items": 0,
            },
            "items": [],
            "total_items": 0,
        }

    serialized_inventory = _serialize_inventory_doc_safe(inventory)
    return {
        "branch": _serialize_branch(branch),
        "inventory": serialized_inventory,
        "items": serialized_inventory.get("items", []),
        "total_items": serialized_inventory.get("total_items", 0),
    }


@router.post("/{branch_id}/inventory/items", status_code=status.HTTP_201_CREATED)
async def create_inventory_item(branch_id: str, item: schemas.InventoryItemCreate, authorization: Optional[str] = Header(None)):
    db = getDatabase()
    user_id = await get_current_user_id(authorization)
    business_id = await get_business_id(user_id, db)
    branch = await _get_branch_for_inventory(branch_id, business_id, db)

    inventory_query = {"business_id": business_id, "branch_id": branch["branch_id"]}
    inventory = await db.inventories.find_one(inventory_query) or {
        "business_id": business_id,
        "branch_id": branch["branch_id"],
        "branch_code": branch.get("branch_code"),
        "branch_name": branch.get("branch_name"),
        "items": [],
        "total_units": 0,
    }

    items = _ensure_item_ids(inventory.get("items", []))
    payload = _normalize_inventory_payload(item.model_dump())

    if payload.get("barcode") and any(str(existing.get("barcode") or "").strip() == str(payload["barcode"]).strip() for existing in items):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Barcode already exists for this branch")
    if payload.get("sku") and any(str(existing.get("sku") or "").strip() == str(payload["sku"]).strip() for existing in items):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SKU already exists for this branch")

    now = datetime.utcnow()
    item_doc = {
        **payload,
        "_id": str(ObjectId()),
        "branch_id": branch["branch_id"],
        "created_at": now,
        "updated_at": now,
    }
    items.append(item_doc)

    inventory_doc = {
        "business_id": business_id,
        "branch_id": branch["branch_id"],
        "branch_code": branch.get("branch_code"),
        "branch_name": branch.get("branch_name"),
        "items": items,
        "total_units": sum(int(existing.get("quantity") or 0) for existing in items),
        "updated_at": now,
    }
    await db.inventories.update_one(inventory_query, {"$set": inventory_doc}, upsert=True)

    serialized_inventory = _serialize_inventory_doc_safe(inventory_doc)
    return {
        "message": "Inventory item added.",
        "item": _serialize_inventory_item_safe(item_doc),
        "inventory": serialized_inventory,
        "items": serialized_inventory.get("items", []),
    }


@router.put("/{branch_id}/inventory/items/{item_id}")
async def update_inventory_item(branch_id: str, item_id: str, updates: schemas.InventoryItemUpdate, authorization: Optional[str] = Header(None)):
    db = getDatabase()
    user_id = await get_current_user_id(authorization)
    business_id = await get_business_id(user_id, db)
    branch = await _get_branch_for_inventory(branch_id, business_id, db)

    inventory_query = {"business_id": business_id, "branch_id": branch["branch_id"]}
    inventory = await db.inventories.find_one(inventory_query)
    if not inventory:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory not found")

    items = _ensure_item_ids(inventory.get("items", []))
    item_index = next((index for index, existing in enumerate(items) if str(existing.get("_id")) == str(item_id)), None)
    if item_index is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory item not found")

    payload = _normalize_inventory_payload(updates.model_dump(exclude_none=True))
    current_item = dict(items[item_index])

    if payload.get("barcode") and any(str(existing.get("barcode") or "").strip() == str(payload["barcode"]).strip() and str(existing.get("_id")) != str(item_id) for existing in items):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Barcode already exists for this branch")
    if payload.get("sku") and any(str(existing.get("sku") or "").strip() == str(payload["sku"]).strip() and str(existing.get("_id")) != str(item_id) for existing in items):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SKU already exists for this branch")

    current_item.update(payload)
    current_item["updated_at"] = datetime.utcnow()
    next_items = [current_item if index == item_index else existing for index, existing in enumerate(items)]

    inventory_doc = {
        "items": next_items,
        "total_units": sum(int(existing.get("quantity") or 0) for existing in next_items),
        "updated_at": datetime.utcnow(),
    }
    await db.inventories.update_one(inventory_query, {"$set": inventory_doc})

    serialized_inventory = _serialize_inventory_doc_safe({**inventory, **inventory_doc})
    return {
        "message": "Inventory item updated.",
        "item": _serialize_inventory_item_safe(current_item),
        "inventory": serialized_inventory,
        "items": serialized_inventory.get("items", []),
    }


@router.delete("/{branch_id}/inventory/items/{item_id}")
async def delete_inventory_item(branch_id: str, item_id: str, authorization: Optional[str] = Header(None)):
    db = getDatabase()
    user_id = await get_current_user_id(authorization)
    business_id = await get_business_id(user_id, db)
    branch = await _get_branch_for_inventory(branch_id, business_id, db)

    inventory_query = {"business_id": business_id, "branch_id": branch["branch_id"]}
    inventory = await db.inventories.find_one(inventory_query)
    if not inventory:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory not found")

    items = _ensure_item_ids(inventory.get("items", []))
    next_items = [item for item in items if str(item.get("_id")) != str(item_id)]
    if len(next_items) == len(items):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory item not found")

    inventory_doc = {
        "items": next_items,
        "total_units": sum(int(existing.get("quantity") or 0) for existing in next_items),
        "updated_at": datetime.utcnow(),
    }
    await db.inventories.update_one(inventory_query, {"$set": inventory_doc})

    serialized_inventory = _serialize_inventory_doc_safe({**inventory, **inventory_doc})
    return {
        "message": "Inventory item deleted.",
        "inventory": serialized_inventory,
        "items": serialized_inventory.get("items", []),
    }


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
