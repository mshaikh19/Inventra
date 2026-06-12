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


async def get_user_role_and_business(user_id: str, db):
    """Retrieve user object, role, roles, businessId, and branchId."""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user ID")
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    roles = user.get("roles") or []
    role = user.get("role", "employee")
    
    business_id = None
    if "businessId" in user and user["businessId"]:
        business_id = str(user["businessId"])
    else:
        # If it's an owner who doesn't have businessId on user doc yet
        business = await db.businesses.find_one({"ownerUserId": user_id})
        if business:
            business_id = str(business["_id"])
            
    if not business_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No business associated with user")
        
    is_owner = role in ("owner", "user") or "owner" in roles
    is_manager = "manager" in roles or role == "manager" or role.endswith("_manager")
    
    return {
        "user": user,
        "role": role,
        "roles": roles,
        "business_id": business_id,
        "branch_id": user.get("branchId"),
        "is_owner": is_owner,
        "is_manager": is_manager,
        "is_employee": not is_owner and not is_manager,
    }


def _employee_task_role_match(user_role: str, user_roles: list, task_role: str) -> bool:
    """True when a task targeted at task_role should be visible to this employee."""
    if not task_role:
        return False
    task_role = str(task_role).strip().lower()
    user_role = str(user_role or "").strip().lower()
    normalized_roles = {str(r or "").strip().lower() for r in (user_roles or [])}
    normalized_roles.add(user_role)

    if task_role in normalized_roles:
        return True
    # Generic "employee" tasks apply to any branch-specific employee role
    if task_role == "employee":
        return (
            user_role == "employee"
            or user_role.endswith("_employee")
            or "employee" in normalized_roles
            or any(r.endswith("_employee") for r in normalized_roles)
        )
    # Typed employee task (e.g. store_employee) also matches generic employee users
    if task_role.endswith("_employee") and (
        user_role == "employee" or "employee" in normalized_roles
    ):
        return True
    # Legacy store managers created as plain "manager" match store_manager tasks
    if task_role == "store_manager" and (
        user_role == "manager" or "manager" in normalized_roles
    ):
        return True
    return False


def _serialize_task(doc: dict) -> dict:
    """Convert MongoDB task document to response format."""
    if not doc:
        return {}
    return {
        "_id": str(doc["_id"]),
        "title": doc["title"],
        "description": doc.get("description"),
        "role": doc["role"],
        "assigned_to": doc.get("assigned_to"),
        "branch_id": doc["branch_id"],
        "business_id": str(doc["business_id"]),
        "priority": doc.get("priority", "medium"),
        "status": doc.get("status", "pending"),
        "assigned_by": doc["assigned_by"],
        "completed_at": doc.get("completed_at").isoformat() if hasattr(doc.get("completed_at"), "isoformat") else None,
        "created_at": doc.get("created_at").isoformat() if hasattr(doc.get("created_at"), "isoformat") else None
    }


# ── CREATE ────────────────────────────────────────────────────────────────────
@router.post("/", status_code=status.HTTP_201_CREATED, response_model=schemas.TaskResponse)
async def create_task(
    task: schemas.TaskCreate,
    authorization: Optional[str] = Header(None),
    db = Depends(getDatabase)
):
    user_id = await get_current_user_id(authorization)
    auth_info = await get_user_role_and_business(user_id, db)
    
    # Check permissions: Owner or Manager
    if not auth_info["is_owner"] and not auth_info["is_manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only owners and managers can create tasks."
        )
        
    # Manager restriction: Must match manager's branch
    if auth_info["is_manager"] and not auth_info["is_owner"]:
        if task.branch_id != auth_info["branch_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Managers can only create tasks for their own branch."
            )
            
    # Verify employee assignment if assigned_to is provided
    if task.assigned_to:
        if not ObjectId.is_valid(task.assigned_to):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid assignee user ID")
        assignee = await db.users.find_one({"_id": ObjectId(task.assigned_to), "businessId": ObjectId(auth_info["business_id"])})
        if not assignee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignee not found in this business")
        if task.branch_id and assignee.get("branchId") != task.branch_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assignee must be in the same branch as the task"
            )

    now = datetime.utcnow()
    task_doc = {
        "title": task.title,
        "description": task.description,
        "role": task.role,
        "assigned_to": task.assigned_to,
        "branch_id": task.branch_id,
        "business_id": ObjectId(auth_info["business_id"]),
        "priority": task.priority.value if hasattr(task.priority, "value") else task.priority,
        "status": "pending",
        "assigned_by": user_id,
        "created_at": now,
        "completed_at": None
    }
    
    result = await db.tasks.insert_one(task_doc)
    task_doc["_id"] = str(result.inserted_id)
    
    return _serialize_task(task_doc)


# ── LIST ──────────────────────────────────────────────────────────────────────
@router.get("/", response_model=List[schemas.TaskResponse])
async def list_tasks(
    authorization: Optional[str] = Header(None),
    db = Depends(getDatabase)
):
    user_id = await get_current_user_id(authorization)
    auth_info = await get_user_role_and_business(user_id, db)
    
    query = {"business_id": ObjectId(auth_info["business_id"])}
    
    if auth_info["is_owner"]:
        # Owners can see all tasks for the business
        pass
    elif auth_info["is_manager"]:
        # Managers can see tasks for their branch
        query["branch_id"] = auth_info["branch_id"]
    else:
        # Employees see tasks for their branch AND (assigned directly OR matching their role)
        query["branch_id"] = auth_info["branch_id"]
        role_filters = set()
        user_role = auth_info["role"]
        user_roles = auth_info.get("roles") or []
        role_filters.add(user_role)
        for r in user_roles:
            role_filters.add(r)
        if str(user_role).endswith("_employee") or "employee" in [str(x).lower() for x in user_roles]:
            role_filters.add("employee")

        query["$or"] = [{"assigned_to": user_id}]
        if role_filters:
            query["$or"].append({"role": {"$in": list(role_filters)}})

    cursor = db.tasks.find(query).sort("created_at", -1)
    tasks = []
    async for doc in cursor:
        tasks.append(_serialize_task(doc))

    return tasks


# ── UPDATE ────────────────────────────────────────────────────────────────────
@router.put("/{task_id}", response_model=schemas.TaskResponse)
async def update_task(
    task_id: str,
    updates: schemas.TaskUpdate,
    authorization: Optional[str] = Header(None),
    db = Depends(getDatabase)
):
    user_id = await get_current_user_id(authorization)
    auth_info = await get_user_role_and_business(user_id, db)
    
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid task ID format")
        
    task_doc = await db.tasks.find_one({"_id": ObjectId(task_id), "business_id": ObjectId(auth_info["business_id"])})
    if not task_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        
    # Permission Checks:
    # 1. Owners: full control.
    # 2. Managers: can modify tasks in their branch.
    # 3. Employees: can ONLY update 'status' (to complete it) if the task is assigned to them or their role.
    
    is_owner = auth_info["is_owner"]
    is_manager = auth_info["is_manager"] and task_doc.get("branch_id") == auth_info["branch_id"]
    
    is_assigned_employee = (
        not is_owner
        and not is_manager
        and task_doc.get("branch_id") == auth_info["branch_id"]
        and (
            task_doc.get("assigned_to") == user_id
            or _employee_task_role_match(
                auth_info["role"],
                auth_info.get("roles") or [],
                task_doc.get("role"),
            )
        )
    )
    
    if not is_owner and not is_manager and not is_assigned_employee:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have permission to modify this task."
        )
        
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    
    if not is_owner and not is_manager:
        # Employees can only update status
        if list(update_data.keys()) != ["status"] and len(update_data) > 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Employees can only update task completion status."
            )
            
    # Handle status change (completed_at)
    if "status" in update_data:
        val = update_data["status"].value if hasattr(update_data["status"], "value") else update_data["status"]
        update_data["status"] = val
        if val == "completed":
            update_data["completed_at"] = datetime.utcnow()
        else:
            update_data["completed_at"] = None
            
    # Serialize priority if updated
    if "priority" in update_data:
        val = update_data["priority"].value if hasattr(update_data["priority"], "value") else update_data["priority"]
        update_data["priority"] = val
        
    # Verify assignee if updated
    if "assigned_to" in update_data and update_data["assigned_to"]:
        assignee_id = update_data["assigned_to"]
        if not ObjectId.is_valid(assignee_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid assignee user ID")
        assignee = await db.users.find_one({"_id": ObjectId(assignee_id), "businessId": ObjectId(auth_info["business_id"])})
        if not assignee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignee not found in this business")
        branch_id_to_check = update_data.get("branch_id") or task_doc.get("branch_id")
        if assignee.get("branchId") != branch_id_to_check:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assignee must be in the same branch as the task"
            )
            
    if update_data:
        await db.tasks.update_one({"_id": ObjectId(task_id)}, {"$set": update_data})
        
    updated_doc = await db.tasks.find_one({"_id": ObjectId(task_id)})
    return _serialize_task(updated_doc)


# ── DELETE ────────────────────────────────────────────────────────────────────
@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    authorization: Optional[str] = Header(None),
    db = Depends(getDatabase)
):
    user_id = await get_current_user_id(authorization)
    auth_info = await get_user_role_and_business(user_id, db)
    
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid task ID format")
        
    task_doc = await db.tasks.find_one({"_id": ObjectId(task_id), "business_id": ObjectId(auth_info["business_id"])})
    if not task_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        
    is_owner = auth_info["is_owner"]
    is_manager = auth_info["is_manager"] and task_doc.get("branch_id") == auth_info["branch_id"]
    
    if not is_owner and not is_manager:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only owners and branch managers can delete tasks."
        )
        
    await db.tasks.delete_one({"_id": ObjectId(task_id)})
    return {"message": "Task deleted successfully."}
