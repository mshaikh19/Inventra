from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional, Iterable

from bson import ObjectId

from app.models.schemas import NotificationCreate, NotificationType


def _slugify(value: str) -> str:
    return "-".join(part for part in str(value or "").lower().replace("_", "-").split() if part)


def _serialize_datetime(value):
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def serialize_notification(doc: dict) -> dict:
    item = dict(doc or {})
    if "_id" in item:
        item["_id"] = str(item["_id"])
    item["created_at"] = _serialize_datetime(item.get("created_at"))
    item["updated_at"] = _serialize_datetime(item.get("updated_at"))
    if item.get("business_id") is not None:
        item["business_id"] = str(item["business_id"])
    # Ensure ObjectId fields are returned as strings to satisfy Pydantic models
    if item.get("user_id") is not None:
        try:
            # convert bson ObjectId to string, leave as-is if already string
            item["user_id"] = str(item["user_id"])
        except Exception:
            pass
    if item.get("branch_id") is not None:
        try:
            item["branch_id"] = str(item["branch_id"])
        except Exception:
            pass
    return item


async def upsert_notification(db, payload: NotificationCreate) -> dict:
    now = datetime.utcnow()
    doc = payload.model_dump()
    doc["business_id"] = ObjectId(payload.business_id) if ObjectId.is_valid(str(payload.business_id)) else str(payload.business_id)
    if payload.user_id and ObjectId.is_valid(str(payload.user_id)):
        doc["user_id"] = ObjectId(payload.user_id)
    doc["created_at"] = now
    doc["updated_at"] = now

    existing = await db.notifications.find_one({
        "business_id": doc["business_id"],
        "key": payload.key,
    })
    if existing:
        await db.notifications.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "title": doc.get("title", ""),
                    "text": doc.get("text", ""),
                    "type": doc.get("type", NotificationType.SYSTEM.value),
                    "branch_id": doc.get("branch_id"),
                    "source": doc.get("source", "system"),
                    "meta": doc.get("meta"),
                    "updated_at": now,
                }
            },
        )
        refreshed = await db.notifications.find_one({"_id": existing["_id"]})
        return serialize_notification(refreshed)

    result = await db.notifications.insert_one(doc)
    created = await db.notifications.find_one({"_id": result.inserted_id})
    
    # Send email alert in the background for new low stock/expiry alerts
    import asyncio
    from app.utils.email import send_alert_email
    type_val = payload.type.value if hasattr(payload.type, "value") else payload.type
    if type_val in ["low_stock", "expiry"]:
        asyncio.create_task(
            send_alert_email(
                db,
                business_id=str(payload.business_id),
                branch_id=str(payload.branch_id) if payload.branch_id else None,
                alert_title=payload.title,
                alert_text=payload.text,
                alert_type=type_val
            )
        )
        
    return serialize_notification(created)


def build_notification_key(prefix: str, *parts: object) -> str:
    return "::".join([_slugify(prefix), *(_slugify(part) for part in parts if part is not None and str(part) != "")])


def build_inventory_notifications(items: Iterable[dict], business_id: str, branch_id: Optional[str], branch_name: Optional[str]) -> list[NotificationCreate]:
    notifications = []
    now = datetime.utcnow()
    for item in items or []:
        quantity = int(item.get("quantity") or item.get("stock") or 0)
        minimum_stock = int(item.get("minimum_stock") or item.get("reorderLevel") or item.get("reorder_level") or 10)
        expiry_raw = item.get("expiry_date") or item.get("expiryDate")
        expiry_date = None
        if expiry_raw and hasattr(expiry_raw, "date"):
            expiry_date = expiry_raw
        elif expiry_raw:
            try:
                expiry_date = datetime.fromisoformat(str(expiry_raw).replace("Z", ""))
            except Exception:
                expiry_date = None

        item_name = item.get("product_name") or item.get("name") or "Unnamed item"
        item_id = item.get("_id") or item.get("product_id") or item.get("sku") or item.get("barcode") or item_name

        if quantity <= minimum_stock:
            notifications.append(NotificationCreate(
                key=build_notification_key("low-stock", branch_id or branch_name or business_id, item_id),
                type=NotificationType.LOW_STOCK,
                title="Low stock alert",
                text=f'"{item_name}" is at {quantity} units, below the threshold of {minimum_stock}.',
                business_id=business_id,
                branch_id=branch_id,
                source="inventory",
                meta={"item_id": str(item_id), "quantity": quantity, "minimum_stock": minimum_stock},
            ))

        if expiry_date:
            days_left = (expiry_date.date() - now.date()).days
            if 0 < days_left <= 10:
                notifications.append(NotificationCreate(
                    key=build_notification_key("expiry", branch_id or branch_name or business_id, item_id, expiry_date.date().isoformat()),
                    type=NotificationType.EXPIRY,
                    title="Expiry warning",
                    text=f'"{item_name}" expires in {days_left} days.',
                    business_id=business_id,
                    branch_id=branch_id,
                    source="inventory",
                    meta={"item_id": str(item_id), "days_left": days_left, "expiry_date": expiry_date.date().isoformat()},
                ))

    return notifications
