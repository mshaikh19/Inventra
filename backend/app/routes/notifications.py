from fastapi import APIRouter, Depends, Header, HTTPException, status
from typing import Optional
from datetime import datetime
from bson import ObjectId

from app.database.mongo import getDatabase
from app.models.schemas import NotificationResponse, NotificationCreate
from app.services.notifications import (
    build_inventory_notifications,
    serialize_notification,
    upsert_notification,
)
from app.utils.security import decodeToken

router = APIRouter(prefix="/notifications", tags=["Notifications"])


async def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        payload = decodeToken(token)
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("No subject in token")
        return user_id
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


async def get_business_id(user_id: str, db) -> str:
    business = await db.businesses.find_one({"ownerUserId": user_id})
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No business found for this user")
    return str(business["_id"])


def _to_object_id(value: str):
    return ObjectId(value) if ObjectId.is_valid(str(value)) else value


async def _seed_dynamic_notifications(db, business_id: str, user_id: str):
    branches = await db.branches.find({"business_id": business_id}).to_list(length=500)
    for branch in branches:
      branch_id = str(branch.get("branch_id") or branch.get("_id"))
      inventory = await db.inventories.find_one({"business_id": business_id, "branch_id": branch_id})
      if not inventory:
          continue
      items = inventory.get("items") or []
      payloads = build_inventory_notifications(items, business_id, branch_id, branch.get("branch_name"))
      for payload in payloads:
          payload.user_id = user_id
          await upsert_notification(db, payload)


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(authorization: Optional[str] = Header(None), unread_only: bool = True, db = Depends(getDatabase)):
    user_id = await get_current_user_id(authorization)
    business_id = await get_business_id(user_id, db)
    await _seed_dynamic_notifications(db, business_id, user_id)

    query = {"business_id": _to_object_id(business_id)}
    if unread_only:
        query["is_read"] = False

    notifications = await db.notifications.find(query).sort("created_at", -1).limit(100).to_list(length=100)
    return [serialize_notification(item) for item in notifications]


@router.get("/count")
async def notification_count(authorization: Optional[str] = Header(None), db = Depends(getDatabase)):
    user_id = await get_current_user_id(authorization)
    business_id = await get_business_id(user_id, db)
    await _seed_dynamic_notifications(db, business_id, user_id)
    count = await db.notifications.count_documents({"business_id": _to_object_id(business_id), "is_read": False})
    return {"count": count}


@router.post("/mark-read")
async def mark_notifications_read(payload: dict, authorization: Optional[str] = Header(None), db = Depends(getDatabase)):
    user_id = await get_current_user_id(authorization)
    business_id = await get_business_id(user_id, db)
    ids = payload.get("ids") or []
    if not isinstance(ids, list):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ids must be a list")

    object_ids = [ _to_object_id(item_id) for item_id in ids ]
    await db.notifications.update_many(
        {"business_id": _to_object_id(business_id), "_id": {"$in": object_ids}},
        {"$set": {"is_read": True, "updated_at": datetime.utcnow()}},
    )
    return {"success": True, "updated": len(object_ids)}


@router.post("/emit")
async def emit_notification(payload: NotificationCreate, authorization: Optional[str] = Header(None), db = Depends(getDatabase)):
    user_id = await get_current_user_id(authorization)
    business_id = await get_business_id(user_id, db)
    if str(payload.business_id) != str(business_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Notification business mismatch")
    payload.user_id = user_id
    created = await upsert_notification(db, payload)
    return {"success": True, "notification": created}