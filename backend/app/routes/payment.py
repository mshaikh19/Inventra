"""
Payment API Routes
Handles payment initiation, verification, refunds, and invoice generation
"""

from fastapi import APIRouter, HTTPException, status, Depends, Header, Request
from fastapi.responses import HTMLResponse
from typing import Optional
from datetime import datetime
from bson import ObjectId
import json
import logging

from app.models.schemas import (
    PaymentInitiateRequest, PaymentInitiateResponse, PaymentVerifyRequest,
    PaymentVerifyResponse, RefundRequest, RefundResponse, PaymentStatus,
    TransactionRecord, InvoiceData, OrderItem
)
from app.database.mongo import getDatabase
from app.services.payment_service import get_payment_service
from app.services.notifications import NotificationCreate, NotificationType, upsert_notification
from app.utils.security import decodeToken

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payments", tags=["payments"])

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
        payload = decodeToken(token)
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
            detail="No business found for this user"
        )
    return str(business["_id"])


async def _emit_payment_notification(db, business_id: str, branch_id: Optional[str], user_id: str, *, key: str, title: str, text: str, notification_type: NotificationType, source: str = "payment", meta: Optional[dict] = None):
    await upsert_notification(
        db,
        NotificationCreate(
            key=key,
            type=notification_type,
            title=title,
            text=text,
            business_id=business_id,
            branch_id=branch_id,
            user_id=user_id,
            source=source,
            meta=meta or {},
        ),
    )


# ── Payment Initiation ────────────────────────────────────────────────────────
@router.post("/initiate", response_model=PaymentInitiateResponse)
async def initiate_payment(
    request: PaymentInitiateRequest,
    authorization: Optional[str] = Header(None),
    db = Depends(getDatabase)
):
    """
    Initiate a new payment order
    
    Returns:
        - razorpay_order_id: Order ID from Razorpay
        - amount: Payment amount
        - currency: Currency (INR)
    """
    try:
        # Get current user
        user_id = await get_current_user_id(authorization)
        business_id = await get_business_id(user_id, db)
        
        # Initialize payment service
        payment_service = get_payment_service()
        
        # Generate internal order ID
        order_id = str(ObjectId())
        
        # Create Razorpay order
        order_response = payment_service.create_order(
            amount=request.amount,
            description=request.description,
            customer_email=request.customer_email,
            customer_phone=request.customer_phone,
            customer_name=request.customer_name,
            business_name=request.business_name,
            order_id=order_id,
            items=request.items,
            metadata={
                "business_id": business_id,
                "branch_id": request.branch_id or "",
                "user_id": user_id
            },
            payment_mode=request.payment_mode
        )
        
        if not order_response["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to create payment order: {order_response.get('error')}"
            )
        
        # Store pending transaction in database
        transaction = {
            "transaction_id": order_id,
            "business_id": ObjectId(business_id),
            "branch_id": request.branch_id,
            "user_id": user_id,
            "razorpay_order_id": order_response["order_id"],
            "razorpay_payment_id": None,
            "amount": request.amount,
            "currency": "INR",
            "status": PaymentStatus.PENDING.value,
            "items": [item.dict() for item in request.items] if request.items else [],
            "customer_name": request.customer_name,
            "customer_email": request.customer_email,
            "customer_phone": request.customer_phone,
            "description": request.description,
            "business_name": request.business_name,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "metadata": order_response["notes"]
        }
        
        await db.payments.insert_one(transaction)
        logger.info(f"Payment initiated: {order_id}")
        
        return PaymentInitiateResponse(
            order_id=order_id,
            razorpay_order_id=order_response["order_id"],
            key_id=payment_service.key_id,
            amount=request.amount,
            currency="INR",
            timeout=900
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initiating payment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate payment: {str(e)}"
        )


# ── Payment Verification ──────────────────────────────────────────────────────
@router.post("/verify", response_model=PaymentVerifyResponse)
async def verify_payment(
    request: PaymentVerifyRequest,
    authorization: Optional[str] = Header(None),
    db = Depends(getDatabase)
):
    """
    Verify Razorpay payment and mark transaction as completed
    
    This endpoint should be called after successful payment on frontend
    """
    try:
        user_id = await get_current_user_id(authorization)
        
        # Initialize payment service
        payment_service = get_payment_service()
        
        # Verify signature
        is_valid = payment_service.verify_payment_signature(
            request.razorpay_order_id,
            request.razorpay_payment_id or "",
            request.razorpay_signature or ""
        )
        
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid payment signature"
            )
        
        # Get payment details from Cashfree (using transaction_id as the Cashfree order_id)
        payment_details = payment_service.get_payment_details(request.order_id)
        
        if not payment_details:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Payment could not be confirmed from the gateway. Please try again."
            )
        
        # Update transaction in database
        transaction = await db.payments.find_one({"transaction_id": request.order_id})
        
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found"
            )
        
        # Update payment status
        update_data = {
            "razorpay_payment_id": request.razorpay_payment_id,
            "status": PaymentStatus.COMPLETED.value,
            "payment_method": payment_details.get("method", "unknown"),
            "updated_at": datetime.utcnow(),
            "receipt_number": payment_details.get("receipt")
        }
        
        await db.payments.update_one(
            {"transaction_id": request.order_id},
            {"$set": update_data}
        )

        await _emit_payment_notification(
            db,
            str(transaction["business_id"]),
            transaction.get("branch_id"),
            user_id,
            key=f"payment-verified::{request.order_id}",
            title="Payment verified",
            text=f"Payment {request.order_id} was verified successfully.",
            notification_type=NotificationType.PAYMENT,
            meta={"transaction_id": request.order_id, "amount": payment_details.get("amount", 0) / 100},
        )
        
        logger.info(f"Payment verified and completed: {request.order_id}")
        
        return PaymentVerifyResponse(
            success=True,
            message="Payment verified successfully",
            transaction_id=request.order_id,
            amount=payment_details.get("amount", 0) / 100,
            payment_id=request.razorpay_payment_id
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying payment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify payment: {str(e)}"
        )


# ── Refund Processing ─────────────────────────────────────────────────────────
@router.post("/{transaction_id}/refund", response_model=RefundResponse)
async def request_refund(
    transaction_id: str,
    request: RefundRequest,
    authorization: Optional[str] = Header(None),
    db = Depends(getDatabase)
):
    """
    Process refund for a completed payment
    """
    try:
        user_id = await get_current_user_id(authorization)
        
        # Get transaction
        transaction = await db.payments.find_one({
            "transaction_id": transaction_id,
            "user_id": user_id
        })
        
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found"
            )
        
        if transaction["status"] != PaymentStatus.COMPLETED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot refund payment with status: {transaction['status']}"
            )
        
        payment_service = get_payment_service()
        
        # Process refund
        refund_amount = request.refund_amount or transaction["amount"]
        refund_response = payment_service.process_refund(
            transaction["razorpay_payment_id"],
            refund_amount,
            request.reason
        )
        
        if not refund_response["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Refund failed: {refund_response.get('error')}"
            )
        
        # Update transaction with refund info
        await db.payments.update_one(
            {"transaction_id": transaction_id},
            {
                "$set": {
                    "status": PaymentStatus.REFUNDED.value,
                    "refund_id": refund_response["refund_id"],
                    "refund_amount": refund_response["amount"],
                    "refund_reason": request.reason,
                    "updated_at": datetime.utcnow()
                }
            }
        )

        await _emit_payment_notification(
            db,
            str(transaction["business_id"]),
            transaction.get("branch_id"),
            user_id,
            key=f"refund-processed::{transaction_id}",
            title="Refund processed",
            text=f"Refund processed for payment {transaction_id}.",
            notification_type=NotificationType.REFUND,
            meta={"transaction_id": transaction_id, "refund_amount": refund_response["amount"]},
        )
        
        logger.info(f"Refund processed: {transaction_id}")
        
        return RefundResponse(
            success=True,
            message="Refund processed successfully",
            refund_id=refund_response["refund_id"],
            refund_amount=refund_response["amount"]
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing refund: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process refund: {str(e)}"
        )


# ── Invoice Generation ────────────────────────────────────────────────────────
@router.get("/{transaction_id}/invoice", response_class=HTMLResponse)
async def get_invoice(
    transaction_id: str,
    authorization: Optional[str] = Header(None),
    db = Depends(getDatabase)
):
    """
    Generate and download invoice for a transaction
    """
    try:
        user_id = await get_current_user_id(authorization)
        
        # Get transaction
        transaction = await db.payments.find_one({
            "transaction_id": transaction_id,
            "user_id": user_id
        })
        
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found"
            )
        
        # Get business details
        business = await db.businesses.find_one({"_id": ObjectId(transaction["business_id"])})
        
        if not business:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business not found"
            )
        
        # Calculate amounts
        payment_service = get_payment_service()
        items = [OrderItem(**item) for item in transaction.get("items", [])]
        amounts = payment_service.calculate_invoice_amounts(items)
        
        # Generate invoice number if not already generated
        if not transaction.get("receipt_number"):
            receipt_number = payment_service.generate_invoice_number(str(transaction["business_id"]))
            await db.payments.update_one(
                {"transaction_id": transaction_id},
                {"$set": {"receipt_number": receipt_number}}
            )
        else:
            receipt_number = transaction["receipt_number"]
        
        # Create invoice data
        invoice_data = InvoiceData(
            invoice_number=receipt_number,
            business_name=business.get("businessName", ""),
            gstin=business.get("gstin"),
            business_email=business.get("email", ""),
            customer_name=transaction["customer_name"],
            customer_email=transaction["customer_email"],
            customer_phone=transaction["customer_phone"],
            items=items,
            subtotal=amounts["subtotal"],
            total_gst=amounts["total_gst"],
            total_amount=amounts["total_amount"],
            payment_method=transaction.get("payment_method", "Unknown"),
            transaction_id=transaction_id,
            invoice_date=transaction["created_at"],
            due_date=None
        )
        
        # Generate HTML invoice
        html = payment_service.format_invoice_html(invoice_data, business.get("gstin"))
        
        logger.info(f"Invoice generated: {transaction_id}")
        return html
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating invoice: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate invoice: {str(e)}"
        )


@router.get("/stats")
async def get_payment_stats(
    authorization: Optional[str] = Header(None),
    db = Depends(getDatabase)
):
    """
    Get consolidated total sales, daily sales, and yesterday comparisons
    """
    try:
        from datetime import timedelta
        user_id = await get_current_user_id(authorization)
        business_id = await get_business_id(user_id, db)
        
        # 1. Fetch completed payments (online gateway)
        cursor_payments = db.payments.find({
            "business_id": ObjectId(business_id),
            "status": PaymentStatus.COMPLETED.value
        })
        payments = await cursor_payments.to_list(length=1000)
        
        # 2. Fetch completed POS sales
        cursor_sales = db.sales.find({
            "business_id": str(business_id)
        })
        sales = await cursor_sales.to_list(length=1000)
        
        merged_transactions = []
        
        # Add all POS sales first
        for s in sales:
            merged_transactions.append({
                "id": str(s["_id"]),
                "amount": float(s.get("grand_total") or s.get("amount_paid") or 0.0),
                "created_at": s.get("created_at") or s.get("sold_at") or datetime.utcnow(),
                "type": "sale",
                "invoice": s.get("invoice_number")
            })
            
        # Add payments that don't match any sale (de-duplicate overlapping)
        for p in payments:
            amount = float(p.get("amount") or 0.0)
            created_at = p.get("created_at") or datetime.utcnow()
            
            is_duplicate = False
            for t in merged_transactions:
                # Deduplicate if within 2 hours time-frame and matching amount
                if abs(t["amount"] - amount) < 1.0 and abs((t["created_at"] - created_at).total_seconds()) < 7200:
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                merged_transactions.append({
                    "id": str(p["_id"]),
                    "amount": amount,
                    "created_at": created_at,
                    "type": "payment",
                    "invoice": p.get("razorpay_order_id") or p.get("cf_order_id")
                })
        
        # Calculate statistics
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start = today_start - timedelta(days=1)
        
        total_revenue = sum(t["amount"] for t in merged_transactions)
        total_count = len(merged_transactions)
        
        daily_revenue = sum(t["amount"] for t in merged_transactions if t["created_at"] >= today_start)
        daily_count = len([t for t in merged_transactions if t["created_at"] >= today_start])
        
        yesterday_revenue = sum(t["amount"] for t in merged_transactions if yesterday_start <= t["created_at"] < today_start)
        
        # Calculate comparison percentage vs yesterday
        if yesterday_revenue > 0:
            diff = daily_revenue - yesterday_revenue
            pct = (diff / yesterday_revenue) * 100
            pct_sign = "+" if pct >= 0 else ""
            comparison_note = f"{pct_sign}{pct:.1f}% vs yesterday"
        else:
            comparison_note = "+100.0% vs yesterday" if daily_revenue > 0 else "0.0% vs yesterday"
            
        # Calculate last 7 days daily sales dynamically
        last_7_days_sales = []
        for i in range(7):
            day_start = today_start - timedelta(days=i)
            day_end = day_start + timedelta(days=1)
            day_revenue = sum(t["amount"] for t in merged_transactions if day_start <= t["created_at"] < day_end)
            last_7_days_sales.append({
                "day": day_start.strftime("%a"),
                "revenue": float(day_revenue)
            })
        last_7_days_sales.reverse()

        return {
            "sales_count": total_count,
            "sales_revenue": total_revenue,
            "daily_sales": daily_revenue,
            "daily_count": daily_count,
            "comparison_note": comparison_note,
            "last_7_days_sales": last_7_days_sales
        }
        
    except Exception as e:
        logger.error(f"Error fetching stats: {str(e)}")
        raise


# ── Transaction History ───────────────────────────────────────────────────────
@router.get("/branch/{branch_id}")
async def get_branch_transactions(
    branch_id: str,
    skip: int = 0,
    limit: int = 50,
    authorization: Optional[str] = Header(None),
    db = Depends(getDatabase)
):
    """
    Get payment transaction history for a branch
    """
    try:
        user_id = await get_current_user_id(authorization)
        business_id = await get_business_id(user_id, db)
        
        # Get transactions
        transactions = await db.payments.find(
            {
                "business_id": ObjectId(business_id),
                "branch_id": branch_id,
                "status": PaymentStatus.COMPLETED.value
            }
        ).skip(skip).limit(limit).sort("created_at", -1).to_list(limit)
        
        # Serialize transaction
        for trans in transactions:
            trans["_id"] = str(trans["_id"])
            trans["business_id"] = str(trans["business_id"])
            trans["created_at"] = trans["created_at"].isoformat()
            trans["updated_at"] = trans["updated_at"].isoformat()
        
        return {
            "success": True,
            "data": transactions,
            "total": len(transactions)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching transactions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch transactions: {str(e)}"
        )


# ── Webhook Handler ───────────────────────────────────────────────────────────
@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    db = Depends(getDatabase)
):
    """
    Handle Razorpay webhooks for payment updates
    
    Razorpay sends webhook events for payment status changes
    """
    try:
        # Get webhook body and signature
        webhook_body = await request.body()
        webhook_signature = request.headers.get("X-Razorpay-Signature")
        
        if not webhook_signature:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing webhook signature"
            )
        
        payment_service = get_payment_service()
        
        # Verify webhook signature
        is_valid = payment_service.verify_webhook_signature(
            webhook_body.decode(),
            webhook_signature
        )
        
        if not is_valid:
            logger.warning("Invalid webhook signature")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid webhook signature"
            )
        
        # Parse webhook body
        webhook_data = json.loads(webhook_body)
        event_type = webhook_data.get("event")
        payload = webhook_data.get("payload", {})
        
        logger.info(f"Webhook received: {event_type}")
        
        # Handle different event types
        if event_type == "payment.authorized":
            payment_info = payload.get("payment", {}).get("entity", {})
            order_id = payment_info.get("order_id")
            payment_id = payment_info.get("id")
            
            # Update transaction
            if order_id:
                await db.payments.update_one(
                    {"razorpay_order_id": order_id},
                    {
                        "$set": {
                            "razorpay_payment_id": payment_id,
                            "status": PaymentStatus.COMPLETED.value,
                            "updated_at": datetime.utcnow()
                        }
                    }
                )
        
        elif event_type == "payment.failed":
            payment_info = payload.get("payment", {}).get("entity", {})
            order_id = payment_info.get("order_id")
            
            if order_id:
                await db.payments.update_one(
                    {"razorpay_order_id": order_id},
                    {
                        "$set": {
                            "status": PaymentStatus.FAILED.value,
                            "updated_at": datetime.utcnow()
                        }
                    }
                )
        
        elif event_type == "refund.completed":
            refund_info = payload.get("refund", {}).get("entity", {})
            refund_id = refund_info.get("id")
            payment_id = refund_info.get("payment_id")
            
            if payment_id:
                await db.payments.update_one(
                    {"razorpay_payment_id": payment_id},
                    {
                        "$set": {
                            "status": PaymentStatus.REFUNDED.value,
                            "refund_id": refund_id,
                            "updated_at": datetime.utcnow()
                        }
                    }
                )
        
        return {"success": True, "message": "Webhook processed"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing webhook: {str(e)}")
        return {"success": False, "error": str(e)}
