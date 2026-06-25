import asyncio
import logging
import os
from datetime import datetime, timedelta
from bson import ObjectId
from app.database.mongo import getDatabase
from app.utils.email import send_executive_digest_email, is_email_active

logger = logging.getLogger(__name__)

# Helper to parse dates safely
def parse_date(date_val):
    if not date_val:
        return None
    if isinstance(date_val, datetime):
        return date_val
    try:
        clean_str = str(date_val).replace("Z", "+00:00")
        return datetime.fromisoformat(clean_str).replace(tzinfo=None)
    except Exception:
        return None

# Local Smart Stock Starter Suggestions Niche Fallback
def get_local_starter_items(business_type: str):
    bt = business_type.lower() if business_type else "retail"
    if bt == "retail":
        return [
            { "name": "Eco-Friendly Notebooks", "category": "Stationery", "demand": "High", "margin": "45%" },
            { "name": "Stainless Steel Water Bottles", "category": "Drinkware", "demand": "Medium", "margin": "50%" },
            { "name": "Universal Charging Cables", "category": "Electronics", "demand": "High", "margin": "60%" },
            { "name": "Reusable Tote Bags", "category": "Accessories", "demand": "Very High", "margin": "40%" },
        ]
    elif bt == "grocery":
        return [
            { "name": "Whole Wheat Sourdough Bread", "category": "Bakery", "demand": "Very High", "margin": "35%" },
            { "name": "Organic Whole Milk (1L)", "category": "Dairy", "demand": "Very High", "margin": "15%" },
            { "name": "Salted Potato Chips", "category": "Snacks", "demand": "High", "margin": "30%" },
            { "name": "Fresh Gala Apples (1kg)", "category": "Produce", "demand": "High", "margin": "25%" },
        ]
    elif bt == "pharmacy":
        return [
            { "name": "Paracetamol 500mg (10 tabs)", "category": "OTC Medicine", "demand": "Very High", "margin": "40%" },
            { "name": "Adhesive Bandages (Pack of 20)", "category": "First Aid", "demand": "High", "margin": "50%" },
            { "name": "Multivitamin Tablets (30 count)", "category": "Supplements", "demand": "High", "margin": "55%" },
            { "name": "Instant Hand Sanitizer (100ml)", "category": "Hygiene", "demand": "Medium", "margin": "45%" },
        ]
    elif bt == "apparel":
        return [
            { "name": "Classic Cotton Crewneck Tee", "category": "T-Shirts", "demand": "Very High", "margin": "65%" },
            { "name": "Athletic Ankle Socks (Pack of 3)", "category": "Socks", "demand": "High", "margin": "70%" },
            { "name": "Fleece Hooded Sweatshirt", "category": "Outerwear", "demand": "Medium", "margin": "60%" },
            { "name": "Canvas Tote Bag", "category": "Accessories", "demand": "High", "margin": "50%" },
        ]
    else:
        return [
            { "name": "Standard Copy Paper (A4)", "category": "Office Supplies", "demand": "High", "margin": "35%" },
            { "name": "Microfiber Cleaning Cloths", "category": "Home Utility", "demand": "Medium", "margin": "50%" },
            { "name": "AA Alkaline Batteries (Pack of 4)", "category": "Electronics", "demand": "High", "margin": "45%" },
        ]

async def compile_and_send_digest_for_user(db, user, force_send: bool = False) -> Optional[dict]:
    """
    Compiles sales and stock metrics and sends the executive digest email
    to a specific business owner or branch manager user.
    """
    owner_email = user.get("email")
    if not owner_email:
        return None

    # Centralized active check
    if not await is_email_active(owner_email):
        logger.info(f"[DIGEST-SCHEDULER] User {owner_email} is inactive or deleted. Suppressing digest.")
        return None

    # Check weekly digest preference unless force_send is True
    if not force_send and not user.get("receiveWeeklyDigest", True):
        logger.info(f"[DIGEST-SCHEDULER] User {owner_email} has opted out of Weekly Digests. Suppressing.")
        return None

    first_name = user.get("firstName", "Manager")
    user_id = user.get("_id")

    # Find their business profile
    business = await db.businesses.find_one({"ownerUserId": str(user_id)})
    if not business:
        # Try finding by ObjectId of user_id just in case
        business = await db.businesses.find_one({"ownerUserId": ObjectId(user_id)})
    
    # If this is a manager, they might not be the business owner, so resolve business via businessId
    if not business and user.get("businessId"):
        bus_id = user.get("businessId")
        business = await db.businesses.find_one({"_id": ObjectId(bus_id) if ObjectId.is_valid(str(bus_id)) else bus_id})
    
    if not business:
        logger.warning(f"[DIGEST-SCHEDULER] No business profile found for user {owner_email}.")
        return None

    business_id = business.get("_id")
    business_name = business.get("name", "Inventra Partner")
    business_type = business.get("businessType") or business.get("type") or "retail"

    # Branch Manager Scoping: if user has branchId and is a manager, filter queries by branch
    user_branch_id = user.get("branchId")
    is_manager = user.get("role") == "manager"
    
    branch_id_filter = None
    branch_name_suffix = ""
    
    if is_manager and user_branch_id:
        branch_id_filter = str(user_branch_id)
        branch_doc = await db.branches.find_one({
            "branch_id": branch_id_filter,
            "business_id": str(business_id)
        })
        if not branch_doc:
            branch_doc = await db.branches.find_one({
                "branch_id": branch_id_filter,
                "business_id": ObjectId(business_id)
            })
        if branch_doc:
            branch_name_suffix = f" - {branch_doc.get('branch_name', 'Branch')}"

    business_name_display = f"{business_name}{branch_name_suffix}"

    # 1. Sales stats (last 7 days)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    sales_query = {
        "business_id": str(business_id),
        "sold_at": {"$gte": seven_days_ago}
    }
    if branch_id_filter:
        sales_query["branch_id"] = branch_id_filter

    sales_cursor = db.sales.find(sales_query)
    sales = await sales_cursor.to_list(length=1000)
    
    sales_revenue = sum(float(s.get("grand_total") or s.get("amount_paid") or 0.0) for s in sales)
    sales_count = len(sales)

    # 2. Low-stock products & upcoming expirations
    inventory_query = {"business_id": business_id}
    if branch_id_filter:
        inventory_query["branch_id"] = branch_id_filter

    inventories_cursor = db.inventories.find(inventory_query)
    inventories = await inventories_cursor.to_list(length=100)

    low_stock_items = []
    expiry_risk_items = []
    now = datetime.utcnow()
    
    total_products_count = 0
    total_stock_qty = 0.0

    for inv in inventories:
        branch_name = inv.get("branch_name", "Unknown Branch")
        items = inv.get("items", [])
        total_products_count += len(items)
        
        for item in items:
            qty = float(item.get("quantity") or item.get("stock") or 0.0)
            total_stock_qty += qty
            min_stock = float(item.get("minimum_stock") or item.get("reorderLevel") or item.get("reorder_level") or 0.0)
            name = item.get("product_name") or item.get("name")
            
            if not name:
                continue

            if min_stock > 0 and qty <= min_stock:
                low_stock_items.append({
                    "name": f"{name} ({branch_name})",
                    "stock": int(qty),
                    "minimum_stock": int(min_stock)
                })

            exp_date_raw = item.get("expiry_date") or item.get("expiryDate")
            exp_date = parse_date(exp_date_raw)
            if exp_date:
                days_left = (exp_date - now).days
                if 0 <= days_left <= 30:
                    expiry_risk_items.append({
                        "name": f"{name} ({branch_name})",
                        "expiry_date": str(exp_date_raw)[:10],
                        "days_left": days_left
                    })

    # 3. Compile Co-Pilot Recommendations incorporating Smart Stock Starter suggestions
    recommendations = []
    
    # Restock alerts
    if low_stock_items:
        recommendations.append({
            "title": "Procurement / Restock Alert",
            "text": f"You have {len(low_stock_items)} items running low. We recommend initiating a procurement reorder to secure branch supplies."
        })
        
    # Expiry clearance markdown alerts
    if expiry_risk_items:
        recommendations.append({
            "title": "Clearance Discounts Advised",
            "text": f"You have {len(expiry_risk_items)} items expiring in less than 30 days. We suggest applying clearance markdowns in the POS billing panel."
        })

    # Sales metrics
    if sales_count > 0:
        avg_ticket = sales_revenue / sales_count
        recommendations.append({
            "title": "Sales Ticket Insights",
            "text": f"Your average POS checkout ticket size is ₹{avg_ticket:.2f} over the last 7 days across {sales_count} sales."
        })

    # Smart Stock Starter suggestions (either cached from Gemini or niche fallbacks)
    starter_recs = business.get("starterRecommendations")
    if not starter_recs:
        starter_recs = get_local_starter_items(business_type)
        
    if starter_recs:
        # Add up to 2 specific Smart Stock recommendations for catalog expansion/onboarding
        for rec in starter_recs[:2]:
            recommendations.append({
                "title": f"Smart Stock: {rec.get('name')}",
                "text": f"Demand: <strong>{rec.get('demand')}</strong> | Target Profit Margin: <strong>{rec.get('margin')}</strong>. Recommended product for your {business_type.lower()} niche."
            })

    stats = {
        "sales_revenue": sales_revenue,
        "sales_count": sales_count,
        "total_products_count": total_products_count,
        "total_stock_qty": total_stock_qty,
        "low_stock_items": low_stock_items,
        "expiry_risk_items": expiry_risk_items,
        "recommendations": recommendations
    }

    # Dispatch the email digest!
    await send_executive_digest_email(
        owner_email=owner_email,
        first_name=first_name,
        business_name=business_name_display,
        stats=stats
    )
    logger.info(f"[DIGEST-SCHEDULER] Digest successfully sent to {owner_email} for business '{business_name_display}'.")
    return stats

async def start_digest_scheduler():
    """
    Background task that runs a loop to send executive digests to all active owners
    every few days.
    """
    # Wait a bit after startup before running the first cycle to allow DB connection to stabilize
    await asyncio.sleep(15)
    
    interval_seconds = int(os.getenv("DIGEST_INTERVAL_SECONDS", "259200")) # 3 days default
    logger.info(f"[DIGEST-SCHEDULER] Starting periodic executive digest scheduler. Interval: {interval_seconds} seconds.")
    
    while True:
        try:
            db = getDatabase()
            if db is not None:
                logger.info("[DIGEST-SCHEDULER] Beginning periodic digest dispatch cycle...")
                
                # Find all active owner and branch manager users
                owners_cursor = db.users.find({
                    "role": {"$in": ["owner", "manager"]},
                    "isActive": True,
                    "isDeleted": {"$ne": True}
                })
                owners = await owners_cursor.to_list(length=500)
                
                logger.info(f"[DIGEST-SCHEDULER] Found {len(owners)} active owner/manager accounts.")
                
                sent_count = 0
                for owner in owners:
                    stats = await compile_and_send_digest_for_user(db, owner)
                    if stats:
                        sent_count += 1
                        
                logger.info(f"[DIGEST-SCHEDULER] Completed digest cycle. Sent: {sent_count}/{len(owners)}.")
            else:
                logger.warning("[DIGEST-SCHEDULER] Database not connected. Skipping this cycle.")
        except Exception as e:
            logger.error(f"[DIGEST-SCHEDULER] Error in scheduler cycle: {e}")
            
        # Sleep until next cycle
        await asyncio.sleep(interval_seconds)


async def compile_and_send_eod_report_for_user(db, user, force_send: bool = False) -> Optional[dict]:
    """
    Compiles today's sales transactions, billing breakdown, live stock alerts,
    and daily co-pilot insights, and dispatches the EOD report email to the business owner or branch manager.
    """
    owner_email = user.get("email")
    if not owner_email:
        return None

    # Verify that user status is active and not deleted
    if not await is_email_active(owner_email):
        logger.info(f"[EOD-SCHEDULER] User {owner_email} is inactive or deleted. Suppressing EOD report.")
        return None

    # Check daily EOD preference unless force_send is True
    if not force_send and not user.get("receiveDailyEOD", True):
        logger.info(f"[EOD-SCHEDULER] User {owner_email} has opted out of Daily EOD reports. Suppressing.")
        return None

    first_name = user.get("firstName", "Manager")
    user_id = user.get("_id")

    # Find business profile
    business = await db.businesses.find_one({"ownerUserId": str(user_id)})
    if not business:
        business = await db.businesses.find_one({"ownerUserId": ObjectId(user_id)})
    
    # If this is a manager, resolve business via businessId
    if not business and user.get("businessId"):
        bus_id = user.get("businessId")
        business = await db.businesses.find_one({"_id": ObjectId(bus_id) if ObjectId.is_valid(str(bus_id)) else bus_id})
    
    if not business:
        logger.warning(f"[EOD-SCHEDULER] No business profile found for user {owner_email}.")
        return None

    business_id = business.get("_id")
    business_name = business.get("name", "Inventra Partner")
    business_type = business.get("businessType") or business.get("type") or "retail"

    # Branch Manager Scoping: if user has branchId and is a manager, filter queries by branch
    user_branch_id = user.get("branchId")
    is_manager = user.get("role") == "manager"
    
    branch_id_filter = None
    branch_name_suffix = ""
    
    if is_manager and user_branch_id:
        branch_id_filter = str(user_branch_id)
        branch_doc = await db.branches.find_one({
            "branch_id": branch_id_filter,
            "business_id": str(business_id)
        })
        if not branch_doc:
            branch_doc = await db.branches.find_one({
                "branch_id": branch_id_filter,
                "business_id": ObjectId(business_id)
            })
        if branch_doc:
            branch_name_suffix = f" - {branch_doc.get('branch_name', 'Branch')}"

    business_name_display = f"{business_name}{branch_name_suffix}"

    # 1. Query today's sales invoices (since midnight UTC)
    now = datetime.utcnow()
    start_of_today = datetime(now.year, now.month, now.day, 0, 0, 0)
    
    sales_query = {
        "business_id": str(business_id),
        "sold_at": {"$gte": start_of_today}
    }
    if branch_id_filter:
        sales_query["branch_id"] = branch_id_filter

    sales_cursor = db.sales.find(sales_query)
    sales = await sales_cursor.to_list(length=1000)
    
    sales_revenue = sum(float(s.get("grand_total") or s.get("amount_paid") or 0.0) for s in sales)
    sales_count = len(sales)
    average_ticket = sales_revenue / sales_count if sales_count > 0 else 0.0

    # Aggregate today's individual item sales
    items_sold = {}
    for s in sales:
        for item in s.get("items", []):
            name = item.get("product_name") or item.get("name") or "Unknown Item"
            qty = int(item.get("quantity") or item.get("qty") or 1)
            price = float(item.get("price") or item.get("rate") or 0.0)
            revenue = qty * price
            
            if name in items_sold:
                items_sold[name]["qty"] += qty
                items_sold[name]["revenue"] += revenue
            else:
                items_sold[name] = {"name": name, "qty": qty, "revenue": revenue}
                
    items_sold_list = sorted(list(items_sold.values()), key=lambda x: x["revenue"], reverse=True)

    # 2. Collect current low-stock products & upcoming expirations (real-time catalog check)
    inventories_cursor = db.inventories.find({"business_id": business_id})
    inventories = await inventories_cursor.to_list(length=100)

    low_stock_items = []
    expiry_risk_items = []
    
    total_products_count = 0
    total_stock_qty = 0.0

    for inv in inventories:
        branch_name = inv.get("branch_name", "Unknown Branch")
        items = inv.get("items", [])
        total_products_count += len(items)
        
        for item in items:
            qty = float(item.get("quantity") or item.get("stock") or 0.0)
            total_stock_qty += qty
            min_stock = float(item.get("minimum_stock") or item.get("reorderLevel") or item.get("reorder_level") or 0.0)
            name = item.get("product_name") or item.get("name")
            
            if not name:
                continue

            if min_stock > 0 and qty <= min_stock:
                low_stock_items.append({
                    "name": f"{name} ({branch_name})",
                    "stock": int(qty),
                    "minimum_stock": int(min_stock)
                })

            exp_date_raw = item.get("expiry_date") or item.get("expiryDate")
            exp_date = parse_date(exp_date_raw)
            if exp_date:
                days_left = (exp_date - now).days
                if 0 <= days_left <= 30:
                    expiry_risk_items.append({
                        "name": f"{name} ({branch_name})",
                        "expiry_date": str(exp_date_raw)[:10],
                        "days_left": days_left
                    })

    # 3. Generate Daily EOD Insights
    insights = []
    
    # Top seller insight
    if items_sold_list:
        top_item = items_sold_list[0]
        insights.append({
            "title": "Today's Top Performer",
            "text": f"<strong>{top_item['name']}</strong> was today's highest revenue generator, with {top_item['qty']} units sold yielding a total of ₹{top_item['revenue']:,.2f}."
        })
        
    # Sales throughput insight
    if sales_count > 0:
        insights.append({
            "title": "POS Activity Summary",
            "text": f"Your team completed {sales_count} checkouts today, maintaining an average ticket size of ₹{average_ticket:,.2f}."
        })
    else:
        insights.append({
            "title": "POS Activity Summary",
            "text": "No sales transactions were logged on the POS billing terminal today. Ensure branch counters are open and recording checkouts."
        })

    # Stock warning insight
    if low_stock_items:
        insights.append({
            "title": "Critical Restock Required",
            "text": f"You have {len(low_stock_items)} catalog items below safety reorder limits. We recommend initiating procurement orders before starting tomorrow's shift."
        })
    else:
        insights.append({
            "title": "Inventory Stability",
            "text": "All active products are currently within safe operating thresholds. No critical restock is required for tomorrow."
        })

    # Smart Stock Niche Focus
    starter_recs = business.get("starterRecommendations")
    if not starter_recs:
        starter_recs = get_local_starter_items(business_type)
    if starter_recs:
        rec = starter_recs[0]
        insights.append({
            "title": f"Smart Stock Focus: {rec.get('name')}",
            "text": f"Expand your catalog in the {business_type.lower()} niche. Targeted profit margin: <strong>{rec.get('margin')}</strong>. Demand intensity is <strong>{rec.get('demand')}</strong>."
        })

    stats = {
        "sales_revenue": sales_revenue,
        "sales_count": sales_count,
        "average_ticket": average_ticket,
        "items_sold_list": items_sold_list,
        "total_products_count": total_products_count,
        "total_stock_qty": total_stock_qty,
        "low_stock_items": low_stock_items,
        "expiry_risk_items": expiry_risk_items,
        "insights": insights
    }

    # Dispatch EOD email!
    from app.utils.email import send_eod_report_email
    await send_eod_report_email(
        owner_email=owner_email,
        first_name=first_name,
        business_name=business_name_display,
        stats=stats
    )
    logger.info(f"[EOD-SCHEDULER] End of Day report successfully sent to {owner_email} for business '{business_name_display}'.")
    return stats


def get_eod_send_hour_for_working_hours(working_hours: str) -> int:
    """
    Parses a working hours string and returns the target EOD sending hour (in 24-hour format).
    - Closing time - 1 hour.
    - If 24 hours/hrs, send at 12 AM (midnight, hour 0).
    - Default fallback is 8 PM (20:00, i.e., hour 20).
    """
    if not working_hours:
        return 20  # Default fallback (8 PM, which is 1 hour before 9 PM)
        
    s = str(working_hours).strip().lower()
    
    # Check for 24 hours
    if "24" in s or "twenty four" in s or "always open" in s:
        return 0  # Midnight (12 AM)
        
    # Standard format is opening-closing, e.g., "9AM-9PM", "09:00 AM - 10:00 PM", "10:00-22:00"
    parts = []
    if "-" in s:
        parts = s.split("-")
    elif "to" in s:
        parts = s.split("to")
        
    if len(parts) >= 2:
        closing_part = parts[-1].strip()
    else:
        closing_part = s
        
    # Now parse the closing time
    import re
    time_match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)?', closing_part)
    if time_match:
        hour = int(time_match.group(1))
        meridiem = time_match.group(3)
        
        # Convert to 24-hour format
        if meridiem == "pm" and hour < 12:
            hour += 12
        elif meridiem == "am" and hour == 12:
            hour = 0
        elif not meridiem:
            # If no AM/PM, assume PM if hour <= 11
            if hour <= 11:
                hour += 12
                
        # EOD should be ONE HOUR BEFORE closing time
        send_hour = (hour - 1) % 24
        return send_hour
        
    return 20  # Default fallback (8 PM)


async def get_user_eod_send_hour(db, user) -> int:
    """
    Determines the EOD send hour for a user based on their role and branch working hours.
    - Owners: uses the latest closing hour among all active branches of the business.
    - Managers: uses their specific branch's closing hour.
    - Fallback: 8 PM (hour 20).
    """
    role = user.get("role")
    user_id = user.get("_id")
    
    # Find business profile
    business = await db.businesses.find_one({"ownerUserId": str(user_id)})
    if not business:
        business = await db.businesses.find_one({"ownerUserId": ObjectId(user_id)})
    if not business and user.get("businessId"):
        bus_id = user.get("businessId")
        business = await db.businesses.find_one({"_id": ObjectId(bus_id) if ObjectId.is_valid(str(bus_id)) else bus_id})
        
    if not business:
        return 20
        
    business_id = business.get("_id")
    
    if role == "manager":
        user_branch_id = user.get("branchId")
        if user_branch_id:
            branch_doc = await db.branches.find_one({
                "branch_id": str(user_branch_id),
                "business_id": str(business_id)
            })
            if not branch_doc:
                branch_doc = await db.branches.find_one({
                    "branch_id": str(user_branch_id),
                    "business_id": ObjectId(business_id)
                })
            if branch_doc:
                working_hours = branch_doc.get("working_hours", "9AM-9PM")
                return get_eod_send_hour_for_working_hours(working_hours)
                
    elif role == "owner":
        # Find all active branches for this business
        branches_cursor = db.branches.find({
            "business_id": {"$in": [str(business_id), ObjectId(business_id)]},
            "status": "ACTIVE"
        })
        branches = await branches_cursor.to_list(length=100)
        
        if branches:
            max_weight = -1
            best_hour = 20
            
            for branch in branches:
                hours_str = branch.get("working_hours", "9AM-9PM")
                h = get_eod_send_hour_for_working_hours(hours_str)
                weight = 24 if h == 0 else h
                if weight > max_weight:
                    max_weight = weight
                    best_hour = h
            return best_hour
            
    return 20


async def start_eod_report_scheduler():
    """
    Background task that runs a loop to check each active owner/manager's EOD sending hour
    (based on their branch working hours) and sends EOD reports when their target hour is reached.
    """
    # Wait a bit after startup for database connection to stabilize
    await asyncio.sleep(30)
    
    logger.info("[EOD-SCHEDULER] Starting End of Day daily report scheduler with dynamic branch closing times.")
    
    # Track last sent date per user to prevent duplicate sends within the same day
    # dict of user_id_str -> date_str (e.g. "2026-06-25")
    last_sent_by_user = {}
    
    while True:
        try:
            db = getDatabase()
            if db is not None:
                now = datetime.now()
                current_date_str = now.strftime("%Y-%m-%d")
                current_hour = now.hour
                
                # Find all active owner and branch manager users
                owners_cursor = db.users.find({
                    "role": {"$in": ["owner", "manager"]},
                    "isActive": True,
                    "isDeleted": {"$ne": True}
                })
                users = await owners_cursor.to_list(length=500)
                
                for user in users:
                    user_id_str = str(user.get("_id"))
                    
                    # 1. Check if we already sent the EOD report to this user today
                    if last_sent_by_user.get(user_id_str) == current_date_str:
                        continue
                        
                    # 2. Determine target EOD send hour for this user
                    target_send_hour = await get_user_eod_send_hour(db, user)
                    
                    # 3. If current hour matches their target hour, send it!
                    if current_hour == target_send_hour:
                        logger.info(f"[EOD-SCHEDULER] Target EOD hour ({target_send_hour}:00) reached for user {user.get('email')}. Compiling and sending...")
                        stats = await compile_and_send_eod_report_for_user(db, user)
                        # Mark as sent for today even if compile fails/suppressed to prevent spinning/spamming
                        last_sent_by_user[user_id_str] = current_date_str
            else:
                logger.warning("[EOD-SCHEDULER] Database not connected. Skipping EOD check.")
        except Exception as e:
            logger.error(f"[EOD-SCHEDULER] Error in EOD scheduler loop: {e}")
            
        # Check every 10 minutes to stay precise without heavy resource use
        await asyncio.sleep(600)

