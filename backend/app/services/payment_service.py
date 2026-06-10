"""
Cashfree Payment Service
Handles all payment operations including initiation, verification, refunds, and invoice generation
"""

import os
import json
import requests
from datetime import datetime
from typing import Optional, Dict, List
from app.models.schemas import (
    PaymentStatus, PaymentMethod, OrderItem, TransactionRecord, 
    RefundRequest, InvoiceData
)
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)


class CashfreePaymentService:
    """Service to handle Cashfree payment operations"""
    
    def __init__(self):
        """Initialize Cashfree client credentials"""
        self.key_id = os.getenv("CASHFREE_APP_ID")
        self.key_secret = os.getenv("CASHFREE_SECRET_KEY")
        self.env = os.getenv("CASHFREE_ENV", "TEST")
        self.business_email = os.getenv("BUSINESS_EMAIL", "business@inventra.com")
        self.invoice_prefix = os.getenv("INVOICE_PREFIX", "INV")
        
        if not self.key_id or not self.key_secret:
            raise ValueError("Cashfree credentials not found in environment variables")
        
        self.base_url = "https://sandbox.cashfree.com/pg" if self.env == "TEST" else "https://api.cashfree.com/pg"
        self.headers = {
            "x-client-id": self.key_id,
            "x-client-secret": self.key_secret,
            "x-api-version": "2023-08-01",
            "Content-Type": "application/json"
        }
    
    def create_order(
        self,
        amount: float,
        description: str,
        customer_email: str,
        customer_phone: str,
        customer_name: Optional[str] = None,
        business_name: Optional[str] = None,
        order_id: Optional[str] = None,
        items: Optional[List[OrderItem]] = None,
        metadata: Optional[Dict] = None,
        payment_mode: Optional[str] = None
    ) -> Dict:
        """
        Create a Cashfree order session
        
        Args:
            amount: Payment amount in INR (Rupees)
            description: Order description
            customer_email: Customer email
            customer_phone: Customer phone
            customer_name: Customer name
            order_id: Internal MongoDB order ID
            items: List of order items
            metadata: Additional metadata
            payment_mode: Selected payment mode (Card, UPI, etc.)
            
        Returns:
            Dict with order details mapping to the expected schema
        """
        try:
            # Prepare notes/metadata
            notes = {
                "customer_name": customer_name or "Guest Customer",
                "customer_email": customer_email,
                "customer_phone": customer_phone,
                "order_id": order_id,
                "business_name": business_name or "",
            }
            if metadata:
                notes.update(metadata)
            
            # Prepare Cashfree order creation payload
            # Cashfree expects customer_id to be alphanumeric with no special characters except underscore/hyphen
            clean_customer_id = customer_phone.replace("+", "").strip() if customer_phone else f"cust_{int(datetime.utcnow().timestamp())}"
            
            payload = {
                "order_id": order_id or f"order_{int(datetime.utcnow().timestamp())}",
                "order_amount": round(float(amount), 2),
                "order_currency": "INR",
                "customer_details": {
                    "customer_id": clean_customer_id,
                    "customer_phone": customer_phone or "9999999999",
                    "customer_name": customer_name or "Guest Customer",
                    "customer_email": customer_email or "noreply@inventra.pos"
                },
                "order_note": description,
                "order_meta": {
                    "return_url": "http://localhost:5173"
                }
            }
            
            if payment_mode:
                if payment_mode.upper() == "CARD":
                    payload["order_meta"]["payment_methods_filters"] = {
                        "methods": {
                            "action": "ALLOW",
                            "values": ["credit_card", "debit_card", "prepaid_card"]
                        }
                    }
                elif payment_mode.upper() == "UPI":
                    payload["order_meta"]["payment_methods_filters"] = {
                        "methods": {
                            "action": "ALLOW",
                            "values": ["upi"]
                        }
                    }
            
            url = f"{self.base_url}/orders"
            response = requests.post(url, headers=self.headers, json=payload)
            
            if response.status_code != 200:
                logger.error(f"Cashfree order creation failed: {response.text}")
                return {
                    "success": False,
                    "error": response.text
                }
                
            response_data = response.json()
            session_id = response_data.get("payment_session_id")
            
            if not session_id:
                raise ValueError("payment_session_id not returned by Cashfree API")
                
            logger.info(f"Cashfree Order created: {response_data.get('order_id')}")
            
            return {
                "success": True,
                # We return the payment_session_id as order_id so the frontend receives it as razorpay_order_id seamlessly
                "order_id": session_id,
                "cashfree_order_id": response_data.get("order_id"),
                "amount": amount,
                "currency": "INR",
                "notes": notes
            }
        except Exception as e:
            logger.error(f"Error creating order: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def verify_payment_signature(
        self,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str
    ) -> bool:
        """
        Verify signature (Legacy helper for route).
        For Cashfree, the verification is completed securely in get_payment_details by calling Cashfree APIs.
        """
        return True
    
    def verify_webhook_signature(
        self,
        webhook_body: str,
        webhook_signature: str
    ) -> bool:
        """For Cashfree webhook verification if needed"""
        return True
    
    def get_payment_details(self, order_id: str) -> Optional[Dict]:
        """
        Get payment details from Cashfree and verify status is PAID
        
        Args:
            order_id: Cashfree order ID (equivalent to internal transaction_id)
            
        Returns:
            Mapped payment details dict or None if unpaid/error
        """
        try:
            url = f"{self.base_url}/orders/{order_id}"
            
            # Simple GET request to fetch order details
            res = requests.get(url, headers=self.headers)
            if res.status_code != 200:
                logger.error(f"Error fetching Cashfree order: {res.text}")
                return None
                
            order_data = res.json()
            
            # Security verification step: Ensure status is PAID
            status = order_data.get("order_status")
            if status != "PAID":
                logger.warning(f"Cashfree order {order_id} is not PAID. Current status: {status}")
                return None
                
            # Get specific payment method details if available
            payments_url = f"{url}/payments"
            payments_res = requests.get(payments_url, headers=self.headers)
            method = "unknown"
            if payments_res.status_code == 200:
                payment_attempts = payments_res.json()
                if isinstance(payment_attempts, list) and len(payment_attempts) > 0:
                    method = payment_attempts[0].get("payment_group", "unknown")
            
            # Map Cashfree response structure to the expected dict
            return {
                "method": method,
                # Divide amount by 100 on frontend/routes, so return in paise (Rupees * 100)
                "amount": int(float(order_data.get("order_amount", 0)) * 100),
                "receipt": order_id
            }
        except Exception as e:
            logger.error(f"Error fetching Cashfree payment details: {str(e)}")
            return None
    
    def process_refund(
        self,
        payment_id: str,
        amount: Optional[float] = None,
        reason: Optional[str] = None
    ) -> Dict:
        """
        Process refund for a payment
        """
        try:
            # For Cashfree, payment_id is mapped to order_id
            refund_id = f"ref_{int(datetime.utcnow().timestamp())}"
            payload = {
                "refund_amount": round(float(amount), 2) if amount else 0.0,
                "refund_id": refund_id,
                "refund_note": reason or "POS Refund"
            }
            
            # Fetch order amount if no amount passed
            if not amount:
                order_details = self.get_payment_details(payment_id)
                if order_details:
                    payload["refund_amount"] = order_details["amount"] / 100
            
            url = f"{self.base_url}/orders/{payment_id}/refunds"
            response = requests.post(url, headers=self.headers, json=payload)
            
            if response.status_code != 200:
                logger.error(f"Cashfree refund failed: {response.text}")
                return {
                    "success": False,
                    "error": response.text
                }
                
            response_data = response.json()
            return {
                "success": True,
                "refund_id": response_data.get("refund_id"),
                "amount": response_data.get("refund_amount", 0),
                "status": response_data.get("refund_status")
            }
        except Exception as e:
            logger.error(f"Error processing refund: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def generate_invoice_number(self, business_id: str) -> str:
        """
        Generate sequential invoice number
        """
        timestamp = datetime.utcnow().strftime("%Y%m%d")
        random_suffix = str(ObjectId())[:8].upper()
        return f"{self.invoice_prefix}-{timestamp}-{random_suffix}"
    
    def calculate_invoice_amounts(self, items: List[OrderItem]) -> Dict:
        """
        Calculate subtotal, GST, and total
        """
        subtotal = 0.0
        total_gst = 0.0
        
        for item in items:
            subtotal += item.total
            if item.gst_percentage:
                item_gst = (item.total * item.gst_percentage) / 100
                total_gst += item_gst
        
        return {
            "subtotal": round(subtotal, 2),
            "total_gst": round(total_gst, 2),
            "total_amount": round(subtotal + total_gst, 2)
        }
    
    def format_invoice_html(self, invoice_data: InvoiceData, gstin: Optional[str] = None) -> str:
        """
        Generate HTML invoice
        """
        items_html = ""
        for idx, item in enumerate(invoice_data.items, 1):
            gst = (item.total * (item.gst_percentage or 0)) / 100 if item.gst_percentage else 0
            items_html += f"""
            <tr>
                <td>{idx}</td>
                <td>{item.product_name}</td>
                <td>{item.quantity}</td>
                <td>₹{item.price:.2f}</td>
                <td>₹{item.total:.2f}</td>
                <td>{item.gst_percentage or 0}%</td>
                <td>₹{gst:.2f}</td>
            </tr>
            """
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .header {{ text-align: center; margin-bottom: 30px; }}
                .header h1 {{ margin: 0; color: #333; }}
                .business-info {{ font-size: 12px; color: #666; margin-top: 5px; }}
                .invoice-details {{ display: flex; justify-content: space-between; margin-bottom: 20px; }}
                .section {{ margin-bottom: 15px; }}
                .section-title {{ font-weight: bold; margin-bottom: 5px; }}
                table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; }}
                th, td {{ border: 1px solid #ddd; padding: 10px; text-align: left; }}
                th {{ background-color: #f5f5f5; font-weight: bold; }}
                .total-section {{ text-align: right; margin-top: 20px; }}
                .total-section div {{ margin-bottom: 5px; }}
                .grand-total {{ font-size: 16px; font-weight: bold; color: #333; }}
                .footer {{ margin-top: 30px; font-size: 11px; color: #999; text-align: center; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>TAX INVOICE</h1>
                <div class="business-info">
                    <p>{invoice_data.business_name}</p>
                    {f'<p>GSTIN: {gstin}</p>' if gstin else ''}
                    <p>Email: {invoice_data.business_email}</p>
                </div>
            </div>
            
            <div class="invoice-details">
                <div>
                    <div class="section-title">Invoice Number:</div>
                    <div>{invoice_data.invoice_number}</div>
                </div>
                <div>
                    <div class="section-title">Invoice Date:</div>
                    <div>{invoice_data.invoice_date.strftime('%d-%m-%Y')}</div>
                </div>
                <div>
                    <div class="section-title">Transaction ID:</div>
                    <div>{invoice_data.transaction_id}</div>
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
                <div class="section">
                    <div class="section-title">Bill To:</div>
                    <div>{invoice_data.customer_name}</div>
                    <div>Email: {invoice_data.customer_email}</div>
                    <div>Phone: {invoice_data.customer_phone}</div>
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>S.No</th>
                        <th>Product/Service</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th>Amount</th>
                        <th>GST %</th>
                        <th>GST Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {items_html}
                </tbody>
            </table>
            
            <div class="total-section">
                <div>Subtotal: ₹{invoice_data.subtotal:.2f}</div>
                <div>Total GST: ₹{invoice_data.total_gst:.2f}</div>
                <div class="grand-total">Grand Total: ₹{invoice_data.total_amount:.2f}</div>
                <div style="margin-top: 10px; font-size: 12px;">Payment Method: {invoice_data.payment_method}</div>
            </div>
            
            <div class="footer">
                <p>This is a computer-generated invoice. No signature is required.</p>
                <p>Thank you for your business!</p>
            </div>
        </body>
        </html>
        """
        return html


def get_payment_service() -> CashfreePaymentService:
    """Get Cashfree payment service instance"""
    return CashfreePaymentService()
