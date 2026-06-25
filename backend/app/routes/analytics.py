from fastapi import APIRouter, HTTPException, status, Depends, Header
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from bson import ObjectId
import logging
from app.database.mongo import getDatabase
from app.utils.security import get_current_user_id, get_business_id
from app.services.digest_scheduler import compile_and_send_digest_for_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["analytics"])

# Helper: parse dates safely
def parse_date(date_val):
    if not date_val:
        return None
    if isinstance(date_val, datetime):
        return date_val
    try:
        # handle ISO format like 2026-06-20T12:00:00.000Z
        clean_str = str(date_val).replace("Z", "+00:00")
        return datetime.fromisoformat(clean_str).replace(tzinfo=None)
    except Exception:
        return None

# ── 1. Expiry Runway Alerts ───────────────────────────────────────────────────
@router.get("/runway")
async def get_expiry_runway(
    authorization: Optional[str] = Header(None),
    db = Depends(getDatabase)
):
    """
    Calculates sales run rate vs product expiration dates.
    Flags items likely to expire before they can be sold.
    """
    try:
        user_id = await get_current_user_id(authorization)
        business_id = await get_business_id(user_id, db)

        # 1. Fetch sales from the last 30 days to calculate velocity
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        sales_cursor = db.sales.find({
            "business_id": str(business_id),
            "sold_at": {"$gte": thirty_days_ago}
        })
        sales = await sales_cursor.to_list(length=2000)

        # Calculate sales velocity (quantity sold per day) per product name
        sales_qty = {}
        for s in sales:
            for item in s.get("items", []):
                prod_name = item.get("product_name") or item.get("name")
                qty = float(item.get("quantity") or 0.0)
                if prod_name:
                    sales_qty[prod_name] = sales_qty.get(prod_name, 0.0) + qty

        sales_velocity = {name: qty / 30.0 for name, qty in sales_qty.items()}

        # 2. Fetch inventory items
        inventory_cursor = db.inventories.find({"business_id": business_id})
        inventories = await inventory_cursor.to_list(length=100)

        expiry_risks = []
        now = datetime.utcnow()

        for inv in inventories:
            branch_name = inv.get("branch_name", "Unknown Branch")
            items = inv.get("items", [])
            for item in items:
                qty = float(item.get("quantity") or item.get("stock") or 0.0)
                if qty <= 0:
                    continue

                prod_name = item.get("product_name") or item.get("name")
                if not prod_name:
                    continue

                exp_date_raw = item.get("expiry_date") or item.get("expiryDate")
                exp_date = parse_date(exp_date_raw)

                if exp_date:
                    days_left = (exp_date - now).days
                    daily_vel = sales_velocity.get(prod_name, 0.0)

                    # If expired already, flag it
                    if days_left <= 0:
                        expiry_risks.append({
                            "product_name": prod_name,
                            "branch_name": branch_name,
                            "stock": qty,
                            "expiry_date": str(exp_date_raw)[:10],
                            "days_left": days_left,
                            "sales_velocity": round(daily_vel, 3),
                            "projected_waste": qty,
                            "risk_level": "EXPIRED"
                        })
                    else:
                        # How much stock will we sell before expiration?
                        projected_sales = daily_vel * days_left
                        projected_waste = max(0.0, qty - projected_sales)

                        if projected_waste > 0 or daily_vel == 0:
                            risk_level = "HIGH" if (days_left < 30 or daily_vel == 0) else "MEDIUM"
                            expiry_risks.append({
                                "product_name": prod_name,
                                "branch_name": branch_name,
                                "stock": qty,
                                "expiry_date": str(exp_date_raw)[:10],
                                "days_left": days_left,
                                "sales_velocity": round(daily_vel, 3),
                                "projected_waste": round(projected_waste, 1),
                                "risk_level": risk_level
                            })

        # Sort risks: EXPIRED and HIGH first, then largest projected waste
        expiry_risks.sort(key=lambda x: (
            0 if x["risk_level"] == "EXPIRED" else (1 if x["risk_level"] == "HIGH" else 2),
            -x["projected_waste"]
        ))

        return {"expiry_risks": expiry_risks}
    except Exception as e:
        logger.error(f"Failed calculating expiry runway: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Runway calculation failed: {str(e)}"
        )


# ── 2. Category Profitability & Contribution ──────────────────────────────────
@router.get("/profitability")
async def get_profitability(
    authorization: Optional[str] = Header(None),
    db = Depends(getDatabase)
):
    """
    Computes revenue contribution and profit margins per product category.
    Uses item cost vs selling price from POS transactions.
    """
    try:
        user_id = await get_current_user_id(authorization)
        business_id = await get_business_id(user_id, db)

        # Fetch all completed transactions
        sales_cursor = db.sales.find({"business_id": str(business_id)})
        sales = await sales_cursor.to_list(length=5000)

        category_stats = {}
        total_business_revenue = 0.0
        total_business_profit = 0.0

        for s in sales:
            for item in s.get("items", []):
                qty = float(item.get("quantity") or 0.0)
                price = float(item.get("price") or item.get("selling_price") or 0.0)
                
                # Try to retrieve cost
                cost = float(item.get("cost") or item.get("cost_price") or item.get("purchase_price") or (price * 0.6))  # 40% margin fallback if cost is missing
                
                category = str(item.get("category") or "General").strip().title()
                
                item_revenue = price * qty
                item_cost = cost * qty
                item_profit = item_revenue - item_cost

                if category not in category_stats:
                    category_stats[category] = {
                        "category": category,
                        "revenue": 0.0,
                        "cost": 0.0,
                        "profit": 0.0,
                        "items_sold": 0
                    }

                category_stats[category]["revenue"] += item_revenue
                category_stats[category]["cost"] += item_cost
                category_stats[category]["profit"] += item_profit
                category_stats[category]["items_sold"] += int(qty)

                total_business_revenue += item_revenue
                total_business_profit += item_profit

        # Compile final shares
        breakdown = []
        for cat, data in category_stats.items():
            rev = data["revenue"]
            profit = data["profit"]
            margin = (profit / rev * 100) if rev > 0 else 0.0
            rev_share = (rev / total_business_revenue * 100) if total_business_revenue > 0 else 0.0
            profit_share = (profit / total_business_profit * 100) if total_business_profit > 0 else 0.0

            breakdown.append({
                "category": cat,
                "revenue": round(rev, 2),
                "profit": round(profit, 2),
                "margin": round(margin, 1),
                "items_sold": data["items_sold"],
                "revenue_share": round(rev_share, 1),
                "profit_share": round(profit_share, 1)
            })

        # Sort by revenue share descending
        breakdown.sort(key=lambda x: -x["revenue"])

        return {
            "total_revenue": round(total_business_revenue, 2),
            "total_profit": round(total_business_profit, 2),
            "blended_margin": round((total_business_profit / total_business_revenue * 100), 1) if total_business_revenue > 0 else 0.0,
            "categories": breakdown
        }
    except Exception as e:
        logger.error(f"Failed calculating profitability: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Profitability analysis failed: {str(e)}"
        )


# ── 3. Clearance Promo Suggester ──────────────────────────────────────────────
@router.get("/promo-suggestions")
async def get_promo_suggestions(
    authorization: Optional[str] = Header(None),
    db = Depends(getDatabase)
):
    """
    Identifies slow-moving or expiring stock.
    Recommends promotional markdown percentages.
    """
    try:
        user_id = await get_current_user_id(authorization)
        business_id = await get_business_id(user_id, db)

        # 1. Fetch sales over last 30 days to calculate velocity
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        sales_cursor = db.sales.find({
            "business_id": str(business_id),
            "sold_at": {"$gte": thirty_days_ago}
        })
        sales = await sales_cursor.to_list(length=2000)

        sales_qty = {}
        for s in sales:
            for item in s.get("items", []):
                prod_name = item.get("product_name") or item.get("name")
                qty = float(item.get("quantity") or 0.0)
                if prod_name:
                    sales_qty[prod_name] = sales_qty.get(prod_name, 0.0) + qty

        # 2. Fetch inventory items
        inventory_cursor = db.inventories.find({"business_id": business_id})
        inventories = await inventory_cursor.to_list(length=100)

        suggestions = []
        now = datetime.utcnow()

        for inv in inventories:
            branch_name = inv.get("branch_name", "Unknown Branch")
            branch_id = inv.get("branch_id") or str(inv.get("_id"))
            items = inv.get("items", [])
            for item in items:
                qty = float(item.get("quantity") or item.get("stock") or 0.0)
                if qty <= 5: # Only suggest clearance for items with meaningful stock
                    continue

                prod_name = item.get("product_name") or item.get("name")
                price = float(item.get("price") or item.get("selling_price") or 0.0)
                sku = item.get("sku") or item.get("barcode") or item.get("product_id") or ""
                
                if not prod_name or price <= 0:
                    continue

                # Check expiry
                exp_date_raw = item.get("expiry_date") or item.get("expiryDate")
                exp_date = parse_date(exp_date_raw)
                
                days_left = 9999
                if exp_date:
                    days_left = (exp_date - now).days

                sales_30d = sales_qty.get(prod_name, 0.0)
                daily_vel = sales_30d / 30.0

                reason = ""
                recommended_discount = 0
                promo_type = ""

                # Rule 1: Product is expired or expiring in < 15 days
                if days_left <= 15:
                    reason = f"Expiring very soon ({days_left} days left). Stock: {int(qty)} units."
                    recommended_discount = 50
                    promo_type = "Clearance 50% Off"
                # Rule 2: Expiring in < 30 days
                elif days_left <= 30:
                    reason = f"Expiring in {days_left} days. Stock: {int(qty)} units."
                    recommended_discount = 30
                    promo_type = "Clearance 30% Off"
                # Rule 3: Slow moving (Velocity < 0.05 units/day and high stock)
                elif daily_vel < 0.1 and qty >= 15:
                    reason = f"Slow-moving item. Selling only {int(sales_30d)} units in last 30 days. Current stock: {int(qty)}."
                    recommended_discount = 20
                    promo_type = "Promotional 20% Off"

                if recommended_discount > 0:
                    suggestions.append({
                        "sku": sku,
                        "product_name": prod_name,
                        "branch_name": branch_name,
                        "branch_id": branch_id,
                        "stock": int(qty),
                        "price": price,
                        "discount_pct": recommended_discount,
                        "discounted_price": round(price * (1 - recommended_discount/100), 2),
                        "reason": reason,
                        "promo_type": promo_type
                    })

        # Sort suggestions: highest discount first
        suggestions.sort(key=lambda x: -x["discount_pct"])
        return {"suggestions": suggestions}
    except Exception as e:
        logger.error(f"Failed generating promo suggestions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Promo suggestion failed: {str(e)}"
        )


# ── 4. Periodic Executive Digest Dispatcher ───────────────────────────────────
@router.post("/send-digest")
async def trigger_digest_email(
    authorization: Optional[str] = Header(None),
    db = Depends(getDatabase)
):
    """
    Compiles recent business metrics and dispatches
    the Executive Summary email digest to the business owner.
    """
    try:
        user_id = await get_current_user_id(authorization)
        
        # Verify requesting user is owner
        # Verify requesting user is owner or branch manager
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user or user.get("role", "user") not in ["owner", "manager"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only business owners and branch managers can trigger executive digests."
            )

        # Call centralized digest compiler & dispatcher
        stats = await compile_and_send_digest_for_user(db, user, force_send=True)
        if not stats:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to send executive digest. Account might be inactive/deleted, or business/branch profile is missing."
            )

        return {
            "status": "success",
            "message": "Executive digest email compiled and dispatched.",
            "recipient": user.get("email"),
            "stats_summary": {
                "sales_revenue": round(stats.get("sales_revenue", 0.0), 2),
                "sales_count": stats.get("sales_count", 0),
                "low_stock_count": len(stats.get("low_stock_items", [])),
                "expiry_risk_count": len(stats.get("expiry_risk_items", []))
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed compiling/sending weekly digest: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Digest dispatch failed: {str(e)}"
        )


# ── 5. End of Day (EOD) Daily Report Dispatcher ────────────────────────────────
@router.post("/send-eod-report")
async def trigger_eod_report_email(
    authorization: Optional[str] = Header(None),
    db = Depends(getDatabase)
):
    """
    Compiles today's sales and inventory metrics and dispatches
    the End of Day (EOD) daily report email to the business owner.
    """
    try:
        user_id = await get_current_user_id(authorization)
        
        # Verify requesting user is owner
        # Verify requesting user is owner or branch manager
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user or user.get("role", "user") not in ["owner", "manager"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only business owners and branch managers can trigger End of Day reports."
            )

        # Import EOD compiler dynamically to avoid circular references
        from app.services.digest_scheduler import compile_and_send_eod_report_for_user

        # Call centralized daily EOD compiler & dispatcher
        stats = await compile_and_send_eod_report_for_user(db, user, force_send=True)
        if not stats:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to send End of Day report. Account might be inactive/deleted, or business/branch profile is missing."
            )

        return {
            "status": "success",
            "message": "End of Day report compiled and dispatched.",
            "recipient": user.get("email"),
            "stats_summary": {
                "sales_revenue": round(stats.get("sales_revenue", 0.0), 2),
                "sales_count": stats.get("sales_count", 0),
                "average_ticket": round(stats.get("average_ticket", 0.0), 2),
                "items_sold_count": len(stats.get("items_sold_list", [])),
                "low_stock_count": len(stats.get("low_stock_items", [])),
                "expiry_risk_count": len(stats.get("expiry_risk_items", []))
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed compiling/sending daily EOD report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"EOD report dispatch failed: {str(e)}"
        )

