from fastapi import APIRouter, HTTPException, status, Depends, Header
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from app.models import schemas
from app.database.mongo import getDatabase
from app.services.notifications import build_inventory_notifications, upsert_notification, NotificationCreate, NotificationType
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
    if ObjectId.is_valid(user_id):
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if user and "businessId" in user and user["businessId"]:
            return str(user["businessId"])
    business = await db.businesses.find_one({"ownerUserId": user_id})
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No business found for this user. Complete business registration first."
        )
    return str(business["_id"])


async def _get_user_access_context(user_id: str, db, business_id: str) -> dict:
    """Resolve owner/manager/employee context for authorization checks."""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user ID")
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    roles = [str(r or "").lower() for r in (user.get("roles") or [])]
    role = str(user.get("role", "")).lower()
    is_owner = role in ("owner", "user") or "owner" in roles
    if not is_owner:
        business = await db.businesses.find_one({"_id": ObjectId(business_id)})
        if business and str(business.get("ownerUserId")) == str(user_id):
            is_owner = True
    is_manager = not is_owner and (
        role == "manager" or role.endswith("_manager") and not role.endswith("inventory_manager") or "manager" in roles
    )
    is_inventory_manager = not is_owner and not is_manager and (
        role == "inventory_manager" or role.endswith("_inventory_manager") or "inventory_manager" in roles
    )
    return {
        "user": user,
        "is_owner": is_owner,
        "is_manager": is_manager,
        "is_inventory_manager": is_inventory_manager,
        "is_employee": not is_owner and not is_manager and not is_inventory_manager,
        "branch_id": user.get("branchId"),
    }


async def _enforce_owner_only(user_id: str, db, business_id: str) -> dict:
    ctx = await _get_user_access_context(user_id, db, business_id)
    if not ctx["is_owner"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only business owners can perform this action.",
        )
    return ctx


async def _enforce_branch_scope(user_id: str, db, business_id: str, branch_id: str) -> dict:
    """Owners access all branches; managers/employees only their assigned branch."""
    ctx = await _get_user_access_context(user_id, db, business_id)
    if ctx["is_owner"]:
        return ctx
    if not ctx["branch_id"] or ctx["branch_id"] != branch_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You can only access your assigned branch.",
        )
    return ctx


async def _enforce_inventory_access(user_id: str, db, business_id: str, branch_id: str) -> dict:
    """Owners and managers can access inventory; inventory_managers can access their branch inventory only."""
    ctx = await _get_user_access_context(user_id, db, business_id)
    if ctx["is_owner"]:
        return ctx
    if ctx["is_manager"]:
        if not ctx["branch_id"] or ctx["branch_id"] != branch_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Managers can only access their assigned branch.",
            )
        return ctx
    if ctx["is_inventory_manager"]:
        if not ctx["branch_id"] or ctx["branch_id"] != branch_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Inventory managers can only access their assigned branch.",
            )
        return ctx
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Forbidden: Only owners, managers, and inventory managers can access inventory.",
    )


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


def _split_full_name(full_name: str) -> tuple[str, str]:
    parts = [part for part in str(full_name or "").strip().split() if part]
    if not parts:
        return "Branch", "Manager"
    if len(parts) == 1:
        return parts[0], ""
    return " ".join(parts[:-1]), parts[-1]


async def _generate_branch_id(db, business_id: str) -> str:
    """Auto-generate a sequential branch ID like BR001, BR002..."""
    count = await db.branches.count_documents({"business_id": business_id})
    return f"BR{str(count + 1).zfill(3)}"


async def _sync_branch_manager(
    db,
    business_id: str,
    business_name: str,
    branch_id: str,
    branch_code: str,
    manager_name: str,
    phone: Optional[str],
    manager_email: Optional[str] = None,
    manager_password: Optional[str] = None
) -> None:
    if not manager_name:
        return

    manager_first_name, manager_last_name = _split_full_name(manager_name)
    business_doc = await db.businesses.find_one({"_id": ObjectId(business_id)})
    owner_user_id = str((business_doc or {}).get("ownerUserId") or "")

    branch_doc = await db.branches.find_one({"branch_id": branch_id, "business_id": ObjectId(business_id)})
    branch_type = "Store"
    if branch_doc and branch_doc.get("branch_type"):
        branch_type = branch_doc["branch_type"]
        if hasattr(branch_type, "value"):
            branch_type = branch_type.value

    branch_type_lower = str(branch_type).lower()
    if branch_type_lower == "warehouse":
        role_name = "warehouse_manager"
    elif branch_type_lower == "franchise":
        role_name = "franchise_manager"
    elif branch_type_lower == "depot":
        role_name = "depot_manager"
    else:
        role_name = "store_manager"

    # Check if a manager with the exact same name and branch already exists
    existing = await db.users.find_one({
        "businessId": ObjectId(business_id),
        "branchId": branch_id,
        "role": {"$in": ["owner", "manager", "warehouse_manager", "franchise_manager", "depot_manager", "store_manager", "user"]},
        "firstName": manager_first_name,
        "lastName": manager_last_name
    })

    if existing:
        existing_id = str(existing.get("_id"))
        existing_roles = existing.get("roles") or []
        is_owner = (
            existing_id == owner_user_id
            or existing.get("role") in ("owner", "user")
            or "owner" in existing_roles
        )
        if is_owner:
            # If the owner is the manager, just update phone/active and keep owner access
            await db.users.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "phone": phone,
                    "isActive": True,
                    "branchId": branch_id
                }}
            )
            return

        # If they already exist, we can just update their phone number, active status and role
        await db.users.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "phone": phone,
                "isActive": True,
                "role": role_name,
                "roles": [role_name, "manager"]
            }}
        )
        return

    # Otherwise, create a new manager user
    if not manager_email:
        clean_name = "".join(c for c in manager_name.lower() if c.isalnum())
        if not clean_name:
            clean_name = "manager"
        base_email = f"{clean_name}@{branch_code.lower()}.inventra.com"

        # Find a unique email candidate
        email_candidate = base_email
        counter = 1
        while await db.users.find_one({"email": email_candidate}):
            email_candidate = f"{clean_name}{counter}@{branch_code.lower()}.inventra.com"
            counter += 1
        manager_email = email_candidate
    else:
        # If the owner manages this branch, keep their owner account intact.
        # They should retain owner permissions instead of becoming a branch manager.
        existing_email = await db.users.find_one({"email": {"$regex": f"^{manager_email.strip()}$", "$options": "i"}})
        if existing_email:
            existing_email_id = str(existing_email.get("_id"))
            existing_email_roles = existing_email.get("roles") or []
            is_owner = (
                existing_email_id == owner_user_id
                or existing_email.get("role") in ("owner", "user")
                or "owner" in existing_email_roles
            )
            is_same_branch_manager = (existing_email.get("branchId") == branch_id)
            
            if is_owner or is_same_branch_manager:
                upd_fields = {
                    "phone": phone,
                    "isActive": True,
                    "branchId": branch_id
                }
                if not is_owner:
                    upd_fields["firstName"] = manager_first_name
                    upd_fields["lastName"] = manager_last_name
                await db.users.update_one(
                    {"_id": existing_email["_id"]},
                    {"$set": upd_fields}
                )
                return

            # If a manager email is specified but is already registered by
            # someone else, make it unique.
            name_part, domain_part = manager_email.split("@", 1)
            counter = 1
            email_candidate = f"{name_part}+{counter}@{domain_part}"
            while await db.users.find_one({"email": email_candidate}):
                counter += 1
                email_candidate = f"{name_part}+{counter}@{domain_part}"
            manager_email = email_candidate

    if not manager_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Manager password is required")

    manager_doc = {
        "email": manager_email,
        "firstName": manager_first_name,
        "lastName": manager_last_name,
        "businessName": business_name,
        "role": role_name,
        "roles": [role_name, "manager"],
        "businessId": ObjectId(business_id),
        "branchId": branch_id,
        "phone": phone,
        "hashedPassword": security.getPasswordHash(manager_password),
        "isActive": True,
        "isVerified": False,
        "createdAt": datetime.utcnow(),
    }

    await db.users.insert_one(manager_doc)

    # Also update the business-wide employees count
    await db.businesses.update_one(
        {"_id": ObjectId(business_id)},
        {"$inc": {"employees": 1}}
    )


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


async def _sync_inventory_notifications(db, business_id: str, branch: dict, inventory_doc: dict) -> None:
    notifications = build_inventory_notifications(
        inventory_doc.get("items") or [],
        business_id,
        branch.get("branch_id"),
        branch.get("branch_name"),
    )
    for payload in notifications:
        await upsert_notification(db, payload)


# ── CREATE ────────────────────────────────────────────────────────────────────
@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_branch(
    branch: schemas.BranchCreate,
    authorization: Optional[str] = Header(None)
):
    db = getDatabase()
    user_id = await get_current_user_id(authorization)
    business_id = await get_business_id(user_id, db)
    await _enforce_owner_only(user_id, db, business_id)

    business = await db.businesses.find_one({"_id": ObjectId(business_id)})
    business_name = (business or {}).get("name") or "Business"

    manager_email = (branch.manager_email or "").strip() or None
    manager_password = (branch.manager_password or "").strip() or None

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
    doc.pop("manager_password", None) # Save manager_email to branch doc, but not password
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

    try:
        await _sync_branch_manager(
            db,
            business_id=business_id,
            business_name=business_name,
            branch_id=branch_id,
            branch_code=doc["branch_code"],
            manager_name=doc.get("manager_name", ""),
            phone=doc.get("phone"),
            manager_email=manager_email,
            manager_password=manager_password
        )
    except Exception as exc:
        await db.branches.delete_one({"_id": ObjectId(doc["_id"])})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": "Unable to create branch manager account",
                "error": str(exc),
            },
        )

    await _initialize_branch_inventory(db, business_id, doc)

    return _serialize_branch(doc)


# ── LIST (all for this business) ──────────────────────────────────────────────
@router.get("/")
async def list_branches(authorization: Optional[str] = Header(None)):
    db = getDatabase()
    user_id = await get_current_user_id(authorization)
    business_id = await get_business_id(user_id, db)
    access = await _get_user_access_context(user_id, db, business_id)

    branch_query = {"business_id": business_id, "status": {"$ne": "Inactive"}}
    if not access["is_owner"] and access["branch_id"]:
        branch_query["branch_id"] = access["branch_id"]

    cursor = db.branches.find(branch_query).sort("branch_id", 1)
    branches = []
    async for doc in cursor:
        if not doc.get("manager_email"):
            existing_user = await db.users.find_one({
                "businessId": ObjectId(business_id),
                "branchId": doc.get("branch_id"),
                "role": {"$in": ["owner", "manager", "warehouse_manager", "franchise_manager", "depot_manager", "store_manager", "user"]}
            })
            if existing_user:
                manager_email = existing_user.get("email")
                await db.branches.update_one({"_id": doc["_id"]}, {"$set": {"manager_email": manager_email}})
                doc["manager_email"] = manager_email
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

    await _enforce_branch_scope(user_id, db, business_id, doc.get("branch_id"))

    if not doc.get("manager_email"):
        existing_user = await db.users.find_one({
            "businessId": ObjectId(business_id),
            "branchId": doc.get("branch_id"),
            "role": {"$in": ["owner", "manager", "warehouse_manager", "franchise_manager", "depot_manager", "store_manager", "user"]}
        })
        if existing_user:
            manager_email = existing_user.get("email")
            await db.branches.update_one({"_id": doc["_id"]}, {"$set": {"manager_email": manager_email}})
            doc["manager_email"] = manager_email

    return _serialize_branch(doc)


@router.get("/{branch_id}/inventory")
async def get_branch_inventory(branch_id: str, authorization: Optional[str] = Header(None)):
    db = getDatabase()
    user_id = await get_current_user_id(authorization)
    business_id = await get_business_id(user_id, db)

    branch = await _get_branch_for_inventory(branch_id, business_id, db)
    await _enforce_inventory_access(user_id, db, business_id, branch["branch_id"])

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

    # Aggregate sales for this branch to get correct sold counts
    pipeline = [
        {"$match": {"business_id": business_id, "branch_id": branch["branch_id"]}},
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.item_id",
            "total_sold": {"$sum": "$items.quantity"}
        }}
    ]
    cursor = db.sales.aggregate(pipeline)
    sales_list = await cursor.to_list(length=1000)
    sales_map = {str(s["_id"]): s["total_sold"] for s in sales_list}
    
    # Inject correct sold counts dynamically
    raw_items = inventory.get("items", [])
    for it in raw_items:
        it_id = str(it.get("_id"))
        it["sold"] = sales_map.get(it_id, 0)
        it["total_sales"] = sales_map.get(it_id, 0)

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
    await _enforce_inventory_access(user_id, db, business_id, branch["branch_id"])

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
    await _sync_inventory_notifications(db, business_id, branch, inventory_doc)
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
    await _enforce_inventory_access(user_id, db, business_id, branch["branch_id"])

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
    await _sync_inventory_notifications(db, business_id, branch, {**inventory, **inventory_doc})
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
    await _enforce_inventory_access(user_id, db, business_id, branch["branch_id"])

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
    await _sync_inventory_notifications(db, business_id, branch, {**inventory, **inventory_doc})
    return {
        "message": "Inventory item deleted.",
        "inventory": serialized_inventory,
        "items": serialized_inventory.get("items", []),
    }


# ── RECORD SALE (POS Checkout) ────────────────────────────────────────────────
class SaleItem(BaseModel):
    item_id: str
    product_name: str
    quantity: int
    selling_price: float
    mrp: Optional[float] = None
    sell_on_mrp: Optional[bool] = False
    discount_percent: Optional[float] = 0
    discount_amount: Optional[float] = 0
    taxable_amount: Optional[float] = 0
    gst_rate: Optional[float] = 0
    cgst_amount: Optional[float] = 0
    sgst_amount: Optional[float] = 0
    igst_amount: Optional[float] = 0
    tax_amount: Optional[float] = 0
    line_total: Optional[float] = 0

class SalePayload(BaseModel):
    items: List[SaleItem]
    invoice_number: str
    payment_mode: str
    amount_paid: float
    grand_total: float
    change_due: float
    customer_name: Optional[str] = "Walk-in Customer"
    customer_state: Optional[str] = "Local"
    cashier: Optional[str] = None

@router.post("/{branch_id}/sales", status_code=status.HTTP_201_CREATED)
async def record_sale(branch_id: str, payload: SalePayload, authorization: Optional[str] = Header(None)):
    db = getDatabase()
    user_id = await get_current_user_id(authorization)
    business_id = await get_business_id(user_id, db)
    branch = await _get_branch_for_inventory(branch_id, business_id, db)
    await _enforce_branch_scope(user_id, db, business_id, branch["branch_id"])

    inventory_query = {"business_id": business_id, "branch_id": branch["branch_id"]}
    inventory = await db.inventories.find_one(inventory_query)
    if not inventory:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory not found for this branch")

    items = _ensure_item_ids(inventory.get("items", []))
    errors = []

    for sold in payload.items:
        idx = next((i for i, it in enumerate(items) if str(it.get("_id")) == str(sold.item_id)), None)
        if idx is None:
            errors.append(f"Item '{sold.product_name}' (id={sold.item_id}) not found in inventory")
            continue
        current_qty = int(items[idx].get("quantity") or 0)
        if current_qty < sold.quantity:
            errors.append(f"Insufficient stock for '{sold.product_name}': available={current_qty}, requested={sold.quantity}")
            continue
        
        # Calculate new sold and total_sales
        prev_sold = int(items[idx].get("sold") or items[idx].get("total_sales") or 0)
        new_sold = prev_sold + sold.quantity
        
        items[idx] = {
            **items[idx],
            "quantity": current_qty - sold.quantity,
            "sold": new_sold,
            "total_sales": new_sold,
            "updated_at": datetime.utcnow(),
        }

    if errors:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="; ".join(errors))

    await db.inventories.update_one(inventory_query, {"$set": {
        "items": items,
        "total_units": sum(int(it.get("quantity") or 0) for it in items),
        "updated_at": datetime.utcnow(),
    }})

    now = datetime.utcnow()
    sale_doc = {
        "business_id": business_id,
        "branch_id": branch["branch_id"],
        "branch_name": branch.get("branch_name"),
        "invoice_number": payload.invoice_number,
        "payment_mode": payload.payment_mode,
        "amount_paid": payload.amount_paid,
        "grand_total": payload.grand_total,
        "change_due": payload.change_due,
        "customer_name": payload.customer_name,
        "customer_state": payload.customer_state,
        "cashier": payload.cashier or user_id,
        "items": [item.model_dump() for item in payload.items],
        "sold_at": now,
        "created_at": now,
    }
    await db.sales.insert_one(sale_doc)

    refreshed = await db.inventories.find_one(inventory_query)
    serialized = _serialize_inventory_doc_safe(refreshed)
    await _sync_inventory_notifications(db, business_id, branch, refreshed)
    return {
        "message": "Sale recorded successfully.",
        "invoice_number": payload.invoice_number,
        "items_sold": len(payload.items),
        "grand_total": payload.grand_total,
        "inventory": serialized,
        "updated_items": serialized.get("items", []),
    }

@router.put("/{branch_id}")
async def update_branch(
    branch_id: str,
    updates: schemas.BranchUpdate,
    authorization: Optional[str] = Header(None)
):
    db = getDatabase()
    user_id = await get_current_user_id(authorization)
    business_id = await get_business_id(user_id, db)
    await _enforce_owner_only(user_id, db, business_id)

    # Find the document
    if ObjectId.is_valid(branch_id):
        query = {"_id": ObjectId(branch_id), "business_id": business_id}
    else:
        query = {"branch_id": branch_id, "business_id": business_id}

    existing = await db.branches.find_one(query)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")

    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_data.pop("manager_password", None) # Do not save password on branch doc!

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

    # Sync/create manager user if manager details are present in updated branch doc
    if doc and doc.get("manager_name"):
        business = await db.businesses.find_one({"_id": ObjectId(business_id)})
        business_name = (business or {}).get("name") or "Business"

        # Resolve manager email:
        manager_email = (updates.manager_email or "").strip() or None
        if not manager_email:
            # Check the branch document first
            manager_email = doc.get("manager_email")
            # If still not found, check users collection
            if not manager_email:
                existing_user = await db.users.find_one({
                    "businessId": ObjectId(business_id),
                    "branchId": doc["branch_id"],
                    "role": {"$in": ["owner", "manager", "warehouse_manager", "franchise_manager", "depot_manager", "store_manager", "user"]}
                })
                if existing_user:
                    manager_email = existing_user.get("email")

        # Save the resolved manager email back to the branch doc if it is not already set
        if manager_email and doc.get("manager_email") != manager_email:
            await db.branches.update_one(query, {"$set": {"manager_email": manager_email}})
            doc["manager_email"] = manager_email

        await _sync_branch_manager(
            db,
            business_id=business_id,
            business_name=business_name,
            branch_id=doc["branch_id"],
            branch_code=doc["branch_code"],
            manager_name=doc["manager_name"],
            phone=doc.get("phone"),
            manager_email=manager_email,
            manager_password=(updates.manager_password or "").strip() or None
        )

    return _serialize_branch(doc)

@router.delete("/{branch_id}")
async def deactivate_branch(branch_id: str, authorization: Optional[str] = Header(None)):
    db = getDatabase()
    user_id = await get_current_user_id(authorization)
    business_id = await get_business_id(user_id, db)
    await _enforce_owner_only(user_id, db, business_id)

    if ObjectId.is_valid(branch_id):
        query = {"_id": ObjectId(branch_id), "business_id": business_id}
    else:
        query = {"branch_id": branch_id, "business_id": business_id}

    existing = await db.branches.find_one(query)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")

    await db.branches.update_one(query, {"$set": {"status": "Inactive", "deactivated_at": datetime.utcnow()}})
    await upsert_notification(
        db,
        NotificationCreate(
            key=f"branch-deactivated::{business_id}::{existing.get('branch_id') or branch_id}",
            type=NotificationType.BRANCH,
            title="Branch deactivated",
            text=f"Branch {existing.get('branch_name') or branch_id} was deactivated.",
            business_id=business_id,
            branch_id=existing.get("branch_id") or branch_id,
            source="branch",
            meta={"branch_name": existing.get("branch_name"), "status": "Inactive"},
        )
    )
    return {"message": f"Branch {branch_id} deactivated successfully."}


class BusinessExpectationsUpdate(BaseModel):
    expected_branches: int
    expected_employees: int

@router.put("/expectations/update")
async def update_business_expectations(
    payload: BusinessExpectationsUpdate,
    authorization: Optional[str] = Header(None)
):
    db = getDatabase()
    user_id = await get_current_user_id(authorization)
    business_id = await get_business_id(user_id, db)

    if payload.expected_branches < 1:
        raise HTTPException(status_code=400, detail="Expected branches must be at least 1")
    if payload.expected_employees < 0:
        raise HTTPException(status_code=400, detail="Expected employees must be at least 0")

    await db.businesses.update_one(
        {"_id": ObjectId(business_id)},
        {"$set": {
            "branches": payload.expected_branches,
            "employees": payload.expected_employees
        }}
    )

    return {"message": "Business details updated successfully."}
