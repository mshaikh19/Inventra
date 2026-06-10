from fastapi import APIRouter, HTTPException, status, Depends, Header
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from app.models import schemas
from app.database.mongo import getDatabase
from app.utils import security

router = APIRouter()


# ── Auth helpers ──────────────────────────────────────────────────────────────
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
            detail="No business found for this user."
        )
    return str(business["_id"])


async def enforce_owner_only(user_id: str, db) -> None:
    """Ensure the user is the business owner."""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only the Business Owner can manage staff."
        )
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only the Business Owner can manage staff."
        )
    
    user_roles = user.get("roles") or []
    is_owner = (
        user.get("role") in ("owner", "user")
        or "owner" in user_roles
    )
    if not is_owner:
        business = await db.businesses.find_one({"ownerUserId": str(user["_id"])})
        if business:
            is_owner = True
            
    if not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only the Business Owner can manage staff."
        )


def _serialize_employee(doc: dict) -> dict:
    """Convert MongoDB user doc to employee response format."""
    if not doc:
        return {}
    return {
        "_id": str(doc["_id"]),
        "email": doc["email"],
        "firstName": doc["firstName"],
        "lastName": doc["lastName"],
        "role": doc.get("role", "employee"),
        "branchId": doc.get("branchId"),
        "phone": doc.get("phone"),
        "isActive": doc.get("isActive", True),
        "createdAt": doc.get("createdAt").isoformat() if hasattr(doc.get("createdAt"), "isoformat") else None
    }


# ── CREATE ────────────────────────────────────────────────────────────────────
@router.post("/", status_code=status.HTTP_201_CREATED, response_model=schemas.EmployeeResponse)
async def create_employee(
    employee: schemas.EmployeeCreate,
    authorization: Optional[str] = Header(None),
    db = Depends(getDatabase)
):
    user_id = await get_current_user_id(authorization)
    await enforce_owner_only(user_id, db)
    business_id = await get_business_id(user_id, db)

    # Check if email is already registered
    existing = await db.users.find_one({"email": employee.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Hash the password
    hashed_pwd = security.getPasswordHash(employee.password)

    role_name = employee.role
    roles_list = [employee.role]
    if employee.branchId:
        branch_doc = await db.branches.find_one({"branch_id": employee.branchId, "business_id": business_id})
        if branch_doc:
            branch_type = branch_doc.get("branch_type", "Store")
            if hasattr(branch_type, "value"):
                branch_type = branch_type.value
            branch_type_lower = str(branch_type).lower()
            
            if employee.role == "manager":
                if branch_type_lower == "warehouse":
                    role_name = "warehouse_manager"
                elif branch_type_lower == "franchise":
                    role_name = "franchise_manager"
                elif branch_type_lower == "depot":
                    role_name = "depot_manager"
                else:
                    role_name = "store_manager"
                roles_list = [role_name, "manager"]
            elif employee.role == "employee":
                if branch_type_lower == "warehouse":
                    role_name = "warehouse_employee"
                elif branch_type_lower == "franchise":
                    role_name = "franchise_employee"
                elif branch_type_lower == "depot":
                    role_name = "depot_employee"
                else:
                    role_name = "store_employee"
                roles_list = [role_name, "employee"]

    # Create the user document
    now = datetime.utcnow()
    user_doc = {
        "email": employee.email,
        "firstName": employee.firstName,
        "lastName": employee.lastName,
        "role": role_name,
        "roles": roles_list,
        "businessId": ObjectId(business_id),
        "branchId": employee.branchId,
        "phone": employee.phone,
        "hashedPassword": hashed_pwd,
        "isActive": True,
        "isVerified": False,
        "createdAt": now
    }

    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = str(result.inserted_id)

    # Dynamically update the employee count of the assigned branch if applicable
    if employee.branchId:
        await db.branches.update_one(
            {"business_id": business_id, "branch_id": employee.branchId},
            {"$inc": {"employee_count": 1}}
        )

    # Also update the business-wide employees count
    await db.businesses.update_one(
        {"_id": ObjectId(business_id)},
        {"$inc": {"employees": 1}}
    )

    return _serialize_employee(user_doc)


@router.get("/", response_model=List[schemas.EmployeeResponse])
async def list_employees(
    authorization: Optional[str] = Header(None),
    db = Depends(getDatabase)
):
    user_id = await get_current_user_id(authorization)
    business_id = await get_business_id(user_id, db)

    business = await db.businesses.find_one({"_id": ObjectId(business_id)})
    owner_user_id = business.get("ownerUserId") if business else None

    query = {
        "businessId": ObjectId(business_id),
        "role": {"$ne": "owner"}
    }
    if owner_user_id and ObjectId.is_valid(owner_user_id):
        query["_id"] = {"$ne": ObjectId(owner_user_id)}

    # Non-owners (managers) can only see employees of their own branch
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if user_doc:
        user_role = str(user_doc.get("role", "")).lower()
        user_roles = [str(r).lower() for r in (user_doc.get("roles") or [])]
        is_owner_user = (
            user_role in ("owner", "user") or
            "owner" in user_roles or
            str(user_doc.get("_id")) == str(owner_user_id) if owner_user_id else False
        )
        if not is_owner_user and user_doc.get("branchId"):
            query["branchId"] = user_doc["branchId"]

    cursor = db.users.find(query)
    employees = []
    async for doc in cursor:
        employees.append(_serialize_employee(doc))

    # If the business owner has a branchId set (i.e. they are managing a branch),
    # include the owner user in the list of staff.
    if owner_user_id and ObjectId.is_valid(owner_user_id):
        owner_doc = await db.users.find_one({"_id": ObjectId(owner_user_id)})
        if owner_doc and owner_doc.get("branchId"):
            employees.append(_serialize_employee(owner_doc))

    return employees


# ── UPDATE ────────────────────────────────────────────────────────────────────
@router.put("/{employee_id}", response_model=schemas.EmployeeResponse)
async def update_employee(
    employee_id: str,
    updates: schemas.EmployeeUpdate,
    authorization: Optional[str] = Header(None),
    db = Depends(getDatabase)
):
    user_id = await get_current_user_id(authorization)
    await enforce_owner_only(user_id, db)
    business_id = await get_business_id(user_id, db)

    if not ObjectId.is_valid(employee_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid employee ID format")

    business = await db.businesses.find_one({"_id": ObjectId(business_id)})
    owner_user_id = business.get("ownerUserId") if business else None

    if employee_id == owner_user_id:
        query = {"_id": ObjectId(employee_id)}
    else:
        query = {"_id": ObjectId(employee_id), "businessId": ObjectId(business_id)}

    existing_employee = await db.users.find_one(query)
    if not existing_employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}

    # Ensure unique email if email is being updated
    if "email" in update_data and update_data["email"] != existing_employee["email"]:
        email_taken = await db.users.find_one({"email": update_data["email"], "_id": {"$ne": ObjectId(employee_id)}})
        if email_taken:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email address already registered by another user")

    # If updating the owner user, enforce owner role and active status
    if employee_id == owner_user_id:
        if "role" in update_data:
            update_data["role"] = "owner"
            update_data["roles"] = ["owner", "user"]
        if "isActive" in update_data:
            update_data["isActive"] = True

    # Handle password hashing if updated
    if "password" in update_data and update_data["password"]:
        update_data["hashedPassword"] = security.getPasswordHash(update_data["password"])
        del update_data["password"]

    # Handle roles array synchronization and branch-specific manager/employee roles
    role_to_check = update_data.get("role") or existing_employee.get("role")
    branch_to_check = update_data.get("branchId") if "branchId" in update_data else existing_employee.get("branchId")
    
    is_manager_role = role_to_check in ["manager", "warehouse_manager", "franchise_manager", "depot_manager", "store_manager"]
    is_employee_role = role_to_check in ["employee", "warehouse_employee", "franchise_employee", "depot_employee", "store_employee"]
    
    if (is_manager_role or is_employee_role) and branch_to_check:
        branch_doc = await db.branches.find_one({"branch_id": branch_to_check, "business_id": business_id})
        if branch_doc:
            branch_type = branch_doc.get("branch_type", "Store")
            if hasattr(branch_type, "value"):
                branch_type = branch_type.value
            branch_type_lower = str(branch_type).lower()
            
            if is_manager_role:
                if branch_type_lower == "warehouse":
                    role_name = "warehouse_manager"
                elif branch_type_lower == "franchise":
                    role_name = "franchise_manager"
                elif branch_type_lower == "depot":
                    role_name = "depot_manager"
                else:
                    role_name = "store_manager"
                update_data["role"] = role_name
                update_data["roles"] = [role_name, "manager"]
            else:
                if branch_type_lower == "warehouse":
                    role_name = "warehouse_employee"
                elif branch_type_lower == "franchise":
                    role_name = "franchise_employee"
                elif branch_type_lower == "depot":
                    role_name = "depot_employee"
                else:
                    role_name = "store_employee"
                update_data["role"] = role_name
                update_data["roles"] = [role_name, "employee"]
    elif "role" in update_data:
        base_role = "manager" if is_manager_role else "employee"
        update_data["role"] = base_role
        update_data["roles"] = [base_role]
    elif "branchId" in update_data and not branch_to_check:
        base_role = "manager" if is_manager_role else "employee"
        update_data["role"] = base_role
        update_data["roles"] = [base_role]

    # Handle branch assignment change and updating employeeCounts
    old_branch_id = existing_employee.get("branchId")
    new_branch_id = update_data.get("branchId")

    if "branchId" in update_data and old_branch_id != new_branch_id:
        # Decrement old branch count
        if old_branch_id:
            await db.branches.update_one(
                {"business_id": business_id, "branch_id": old_branch_id},
                {"$inc": {"employee_count": -1}}
            )
        # Increment new branch count
        if new_branch_id:
            await db.branches.update_one(
                {"business_id": business_id, "branch_id": new_branch_id},
                {"$inc": {"employee_count": 1}}
            )

    # Handle activation status changes and updating business-wide employees count
    old_active = existing_employee.get("isActive", True)
    new_active = update_data.get("isActive")
    if new_active is not None and old_active != new_active:
        diff = 1 if new_active else -1
        await db.businesses.update_one(
            {"_id": ObjectId(business_id)},
            {"$inc": {"employees": diff}}
        )

    if update_data:
        update_data["updatedAt"] = datetime.utcnow()
        await db.users.update_one(query, {"$set": update_data})

    updated_doc = await db.users.find_one(query)
    return _serialize_employee(updated_doc)


# ── DELETE (Soft Deactivation) ────────────────────────────────────────────────
@router.delete("/{employee_id}")
async def deactivate_employee(
    employee_id: str,
    authorization: Optional[str] = Header(None),
    db = Depends(getDatabase)
):
    user_id = await get_current_user_id(authorization)
    await enforce_owner_only(user_id, db)
    business_id = await get_business_id(user_id, db)

    if not ObjectId.is_valid(employee_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid employee ID format")

    business = await db.businesses.find_one({"_id": ObjectId(business_id)})
    owner_user_id = business.get("ownerUserId") if business else None

    if employee_id == owner_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Business Owner account cannot be deactivated.")

    query = {"_id": ObjectId(employee_id), "businessId": ObjectId(business_id)}
    existing_employee = await db.users.find_one(query)
    if not existing_employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    # Soft deactivate
    if existing_employee.get("isActive", True):
        await db.users.update_one(query, {"$set": {"isActive": False, "updatedAt": datetime.utcnow()}})
        
        # Decrement employee_count for branch
        branch_id = existing_employee.get("branchId")
        if branch_id:
            await db.branches.update_one(
                {"business_id": business_id, "branch_id": branch_id},
                {"$inc": {"employee_count": -1}}
            )

        # Decrement business-wide count
        await db.businesses.update_one(
            {"_id": ObjectId(business_id)},
            {"$inc": {"employees": -1}}
        )

    return {"message": "Employee deactivated successfully."}
