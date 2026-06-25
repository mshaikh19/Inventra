import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests
import os
import re
import logging
from typing import List, Optional
from bson import ObjectId

logger = logging.getLogger(__name__)

EMAIL_SERVICE = os.getenv("EMAIL_SERVICE", "smtp")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "no-reply@inventra.com")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://inventra-sage-rho.vercel.app")

# Brand Name
BRAND_DISPLAY_NAME = "Inventra"

async def is_email_active(user_email: str) -> bool:
    """
    Query database to verify that the email belongs to an active user.
    If the user has isActive == False or isDeleted == True, we suppress the email.
    """
    try:
        from app.database.mongo import getDatabase
        db = getDatabase()
        if db is None:
            # If DB is not connected/initialized, default to True so we don't block
            return True
            
        user = await db.users.find_one({
            "email": {"$regex": f"^{re.escape(user_email)}$", "$options": "i"}
        })
        if user:
            is_active = user.get("isActive", True)
            is_deleted = user.get("isDeleted", False)
            if not is_active or is_deleted:
                logger.warning(f"[EMAIL-SUPPRESS] Outbound email suppressed for {user_email}: isActive={is_active}, isDeleted={is_deleted}")
                return False
        return True
    except Exception as e:
        logger.error(f"[EMAIL] Error verifying user status: {e}")
        return True  # Fallback to True to prevent blocking email triggers during DB blips


async def send_email(to_emails: List[str], subject: str, html_content: str):
    if not to_emails:
        return

    # Filter recipients to ensure they are active & not deleted
    active_emails = []
    for email in to_emails:
        if await is_email_active(email):
            active_emails.append(email)

    if not active_emails:
        logger.info(f"[EMAIL] No active recipients for email: '{subject}'. Suppressing delivery.")
        return
    
    if EMAIL_SERVICE == "resend" and RESEND_API_KEY:
        await _send_resend(active_emails, subject, html_content)
    elif EMAIL_SERVICE == "smtp" and SMTP_USERNAME and SMTP_PASSWORD:
        await _send_smtp(active_emails, subject, html_content)
    elif SMTP_USERNAME and SMTP_PASSWORD:
        # Fallback to SMTP if credentials exist but EMAIL_SERVICE is not explicitly resend
        await _send_smtp(active_emails, subject, html_content)
    elif RESEND_API_KEY:
        # Fallback to Resend
        await _send_resend(active_emails, subject, html_content)
    else:
        logging.warning("Email service is not configured (missing RESEND_API_KEY or SMTP credentials)")
        # Print for local development testing
        print("\n=== [DEVELOPMENT] OUTGOING EMAIL ===")
        print(f"From: {BRAND_DISPLAY_NAME} <{SMTP_FROM}>")
        print(f"To: {active_emails}")
        print(f"Subject: {subject}")
        print(f"HTML Content:\n{html_content}")
        print("====================================\n")


async def _send_resend(to_emails: List[str], subject: str, html_content: str):
    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "from": f"{BRAND_DISPLAY_NAME} <{SMTP_FROM}>",
        "to": to_emails,
        "subject": subject,
        "html": html_content
    }
    
    import asyncio
    loop = asyncio.get_event_loop()
    
    def _blocking_resend():
        try:
            res = requests.post(url, headers=headers, json=payload, timeout=10.0)
            if res.status_code >= 400:
                logging.error(f"Resend email dispatch failed: {res.text}")
        except Exception as e:
            logging.error(f"Failed calling Resend API: {e}")
            
    await loop.run_in_executor(None, _blocking_resend)


async def _send_smtp(to_emails: List[str], subject: str, html_content: str):
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{BRAND_DISPLAY_NAME} <{SMTP_FROM}>"
        msg['To'] = ", ".join(to_emails)
        
        part = MIMEText(html_content, 'html')
        msg.attach(part)
        
        import asyncio
        loop = asyncio.get_event_loop()
        
        def _blocking_send():
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10.0) as server:
                server.starttls()
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
                server.sendmail(SMTP_FROM, to_emails, msg.as_string())
                
        await loop.run_in_executor(None, _blocking_send)
    except Exception as e:
        logging.error(f"SMTP email dispatch failed: {e}")


def get_email_base_layout(subject: str, badge_text: Optional[str], badge_color: Optional[str], content_html: str) -> str:
    """
    Wraps content in an extremely premium, responsive B2B SaaS layout (Stripe/Vercel-style).
    Uses inlined CSS with a robust media query block for fluid resizing on smaller screens.
    """
    badge_html = ""
    if badge_text and badge_color:
        badge_html = f"""
        <td style="text-align: right; vertical-align: middle; padding: 0;">
            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: {badge_color}; border: 1px solid {badge_color}; padding: 3.5px 8px; border-radius: 4px; letter-spacing: 0.06em; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                {badge_text}
            </span>
        </td>
        """

    return f"""<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <title>{subject}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body {{
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      width: 100% !important;
      background-color: #f8fafc;
      -webkit-font-smoothing: antialiased;
    }}
    .btn:hover {{
      background-color: #1e293b !important;
      border-color: #1e293b !important;
    }}
    @media only screen and (max-width: 600px) {{
      .email-container {{
        width: 100% !important;
        padding: 12px !important;
      }}
      .email-card {{
        border-radius: 8px !important;
      }}
      .email-header {{
        padding: 24px 24px 16px 24px !important;
      }}
      .email-content {{
        padding: 24px 24px !important;
      }}
      .email-footer {{
        padding: 20px 24px !important;
      }}
    }}
    @media only screen and (max-width: 480px) {{
      .col-stack {{
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
        padding: 0 !important;
      }}
      .border-left-mobile {{
        border-left: none !important;
        border-top: 1px solid #e2e8f0 !important;
        padding-top: 16px !important;
        margin-top: 16px !important;
      }}
    }}
  </style>
</head>
<body style="margin: 0; padding: 0; width: 100% !important; background-color: #f8fafc; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="background-color: #f8fafc; padding: 48px 20px; color: #334155; line-height: 1.6;">
    <div class="email-container" style="max-width: 560px; margin: 0 auto;">
      <!-- Main Card -->
      <div class="email-card" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01); overflow: hidden;">
        
        <!-- Top decorative gradient bar -->
        <div style="height: 5px; background: linear-gradient(90deg, #0f172a 0%, #334155 100%);"></div>
        
        <!-- Header -->
        <div class="email-header" style="padding: 32px 32px 24px 32px; border-bottom: 1px solid #f1f5f9;">
          <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 0;">
            <tr>
              <td style="vertical-align: middle; padding: 0;">
                <a href="{FRONTEND_URL}" style="font-size: 18px; font-weight: 800; color: #0f172a; text-decoration: none; letter-spacing: -0.03em; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: inline-block;">
                  {BRAND_DISPLAY_NAME}
                </a>
              </td>
              {badge_html}
            </tr>
          </table>
        </div>
        
        <!-- Content -->
        <div class="email-content" style="padding: 32px; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          {content_html}
        </div>
        
        <!-- Footer -->
        <div class="email-footer" style="padding: 24px 32px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b; background-color: #fafafa; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 0;">
            <tr>
              <td style="padding: 0;">
                <p style="margin: 0 0 4px 0; color: #475569; font-weight: 500;">Questions? Reply directly to this email.</p>
                <p style="margin: 0; color: #94a3b8;">&copy; 2026 {BRAND_DISPLAY_NAME}. All rights reserved.</p>
              </td>
              <td style="text-align: right; padding: 0; vertical-align: bottom;">
                <a href="{FRONTEND_URL}" style="color: #0f172a; text-decoration: none; font-weight: 600;">Website Portal</a>
              </td>
            </tr>
          </table>
        </div>
        
      </div>
    </div>
  </div>
</body>
</html>"""


async def send_welcome_email(user_email: str, first_name: str):
    content_html = f"""
    <h1 style="margin-top: 0; margin-bottom: 12px; font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: -0.03em; line-height: 1.3;">Welcome to {BRAND_DISPLAY_NAME}, {first_name}</h1>
    <p style="font-size: 14.5px; color: #334155; margin-top: 0; margin-bottom: 24px; line-height: 1.6;">
        Your account is fully configured and ready. {BRAND_DISPLAY_NAME} helps you manage store operations, track real-time sales, and optimize inventory levels using predictive data.
    </p>
    
    <div style="margin-bottom: 32px;">
        <h2 style="margin-top: 0; margin-bottom: 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.06em; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">Getting Started:</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <tr>
                <td style="width: 3px; background-color: #0f172a; border-radius: 2px; padding: 0; vertical-align: top;"></td>
                <td style="padding: 0 0 0 16px; vertical-align: top;">
                    <strong style="font-size: 14px; color: #0f172a; display: block; margin-bottom: 2px;">Configure Branches</strong>
                    <span style="font-size: 13px; color: #475569; line-height: 1.5;">Map your physical store locations and assign employees to specific branch counters.</span>
                </td>
            </tr>
        </table>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <tr>
                <td style="width: 3px; background-color: #0f172a; border-radius: 2px; padding: 0; vertical-align: top;"></td>
                <td style="padding: 0 0 0 16px; vertical-align: top;">
                    <strong style="font-size: 14px; color: #0f172a; display: block; margin-bottom: 2px;">Add Products</strong>
                    <span style="font-size: 13px; color: #475569; line-height: 1.5;">Load items individually or import your catalog via spreadsheet in the inventory panel.</span>
                </td>
            </tr>
        </table>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 0;">
            <tr>
                <td style="width: 3px; background-color: #0f172a; border-radius: 2px; padding: 0; vertical-align: top;"></td>
                <td style="padding: 0 0 0 16px; vertical-align: top;">
                    <strong style="font-size: 14px; color: #0f172a; display: block; margin-bottom: 2px;">Launch POS Terminal</strong>
                    <span style="font-size: 13px; color: #475569; line-height: 1.5;">Open the POS billing desk to record transactions, accept payments, and update stock levels.</span>
                </td>
            </tr>
        </table>
    </div>
    
    <div style="margin-top: 32px;">
        <a href="{FRONTEND_URL}" class="btn" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; font-weight: 600; border-radius: 6px; font-size: 13.5px; text-align: center; border: 1px solid #0f172a;">Go to Dashboard</a>
    </div>
    """
    html_content = get_email_base_layout(f"Welcome to {BRAND_DISPLAY_NAME}", "Onboarding", "#0f172a", content_html)
    await send_email([user_email], f"Welcome to {BRAND_DISPLAY_NAME}", html_content)


async def send_alert_email(db, business_id: str, branch_id: Optional[str], alert_title: str, alert_text: str, alert_type: str):
    try:
        bus_id = ObjectId(business_id) if ObjectId.is_valid(str(business_id)) else business_id
        
        # Retrieve the business to find the ownerUserId
        owner_user_id = None
        business = await db.businesses.find_one({"_id": bus_id})
        if business:
            owner_user_id = business.get("ownerUserId")
            
        query = {
            "isActive": True,
            "isDeleted": {"$ne": True},
            "receiveLowStockAlerts": {"$ne": False}
        }
        
        clauses = []
        if owner_user_id and ObjectId.is_valid(owner_user_id):
            clauses.append({"_id": ObjectId(owner_user_id)})
            
        staff_clause = {"businessId": bus_id}
        if branch_id:
            branch_id_val = ObjectId(branch_id) if ObjectId.is_valid(str(branch_id)) else branch_id
            staff_clause["branchId"] = branch_id_val
            
        clauses.append(staff_clause)
        
        if len(clauses) > 1:
            query["$or"] = clauses
        else:
            query.update(staff_clause)
            
        users_cursor = db.users.find(query)
        users = await users_cursor.to_list(length=100)
        
        to_emails = [u["email"] for u in users if u.get("email")]
        if not to_emails:
            return
            
        color_map = {
            "low-stock": "#d97706", # Amber-600
            "expiry": "#dc2626",    # Red-600
            "payment": "#0f172a"    # Charcoal Slate
        }
        color = color_map.get(alert_type, "#0f172a")
        badge_title = f"{alert_type.replace('-', ' ')}"
        
        content_html = f"""
        <h1 style="margin-top: 0; margin-bottom: 16px; font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; line-height: 1.3;">{alert_title}</h1>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid {color}; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 14px; font-weight: 500; color: #1e293b; line-height: 1.6;">{alert_text}</p>
        </div>
        
        <p style="font-size: 13.5px; line-height: 1.6; color: #475569; margin-bottom: 28px;">
            This system warning was automatically triggered based on live database parameters. Log in to your dashboard to review stock allocations, safety limits, or branch details.
        </p>
        
        <div>
            <a href="{FRONTEND_URL}" class="btn" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; font-weight: 600; border-radius: 6px; font-size: 13.5px; text-align: center; border: 1px solid #0f172a;">Go to Dashboard</a>
        </div>
        """
        
        html_content = get_email_base_layout(f"{BRAND_DISPLAY_NAME} Alert: {alert_title}", badge_title, color, content_html)
        await send_email(to_emails, f"{BRAND_DISPLAY_NAME} Alert: {alert_title}", html_content)
    except Exception as e:
        logging.error(f"Failed to generate/send alert email: {e}")


async def send_password_reset_email(user_email: str, first_name: str, token: str):
    reset_link = f"{FRONTEND_URL}/forgot?token={token}"
    content_html = f"""
    <h1 style="margin-top: 0; margin-bottom: 12px; font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.03em; line-height: 1.3;">Reset your password</h1>
    <p style="font-size: 14.5px; color: #334155; margin-top: 0; margin-bottom: 24px; line-height: 1.6;">
        We received a request to reset the password for your account. Click the button below to choose a new password. This link is valid for <strong>60 minutes</strong>.
    </p>
    
    <div style="margin-bottom: 28px;">
        <a href="{reset_link}" class="btn" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; font-weight: 600; border-radius: 6px; font-size: 13.5px; text-align: center; border: 1px solid #0f172a;">Reset Password</a>
    </div>
    
    <div style="font-size: 12px; color: #64748b; line-height: 1.6; border-top: 1px solid #f1f5f9; padding-top: 20px; margin-bottom: 0;">
        If you did not request a password reset, you can safely ignore this email.
        <br /><br />
        If the button above does not work, copy and paste the following URL into your browser:
        <br />
        <a href="{reset_link}" style="color: #0f172a; text-decoration: underline; word-break: break-all; font-weight: 500;">{reset_link}</a>
    </div>
    """
    html_content = get_email_base_layout("Reset your password", "Security", "#0f172a", content_html)
    await send_email([user_email], f"Reset your {BRAND_DISPLAY_NAME} password", html_content)


async def send_employee_setup_email(employee_email: str, first_name: str, business_name: str, role: str):
    login_link = f"{FRONTEND_URL}/login"
    content_html = f"""
    <h1 style="margin-top: 0; margin-bottom: 12px; font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.03em; line-height: 1.3;">Welcome to the team</h1>
    <p style="font-size: 14.5px; color: #334155; margin-top: 0; margin-bottom: 24px; line-height: 1.6;">
        A staff account has been set up for you at <strong>{business_name}</strong> on the Inventra portal.
    </p>
    
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 28px;">
        <table style="width: 100%; font-size: 13.5px; color: #334155; line-height: 1.6; border-collapse: collapse; margin: 0; padding: 0;">
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="font-weight: 600; padding: 8px 0; width: 120px; color: #475569; vertical-align: top;">Organization:</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 500; vertical-align: top;">{business_name}</td>
            </tr>
            <tr>
                <td style="font-weight: 600; padding: 8px 0; color: #475569; vertical-align: top;">Assigned Role:</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 500; text-transform: capitalize; vertical-align: top;">{role.replace('_', ' ')}</td>
            </tr>
        </table>
    </div>
    
    <p style="font-size: 13.5px; color: #334155; margin-bottom: 24px; line-height: 1.6;">
        Log in using your email address and update your password to complete your profile setup.
    </p>
    
    <div>
        <a href="{login_link}" class="btn" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; font-weight: 600; border-radius: 6px; font-size: 13.5px; text-align: center; border: 1px solid #0f172a;">Login to Portal</a>
    </div>
    """
    html_content = get_email_base_layout("Welcome to the team", "Onboarding", "#0f172a", content_html)
    await send_email([employee_email], f"Welcome to the team at {business_name}", html_content)


async def send_executive_digest_email(owner_email: str, first_name: str, business_name: str, stats: dict):
    """Send periodic executive digest email to business owner."""
    sales_revenue = stats.get("sales_revenue", 0.0)
    sales_count = stats.get("sales_count", 0)
    low_stock_items = stats.get("low_stock_items", [])
    expiry_risk_items = stats.get("expiry_risk_items", [])
    recommendations = stats.get("recommendations", [])
    
    total_products = stats.get("total_products_count", 0)
    total_stock = stats.get("total_stock_qty", 0.0)
    
    # Format low stock section
    low_stock_html = ""
    if total_products == 0:
        low_stock_html = "<div style='color: #475569; font-size: 13.5px; padding: 24px; text-align: center; border: 1px dashed #e2e8f0; border-radius: 8px; background-color: #f8fafc; font-weight: 500;'>No products registered. Go to the Inventory Desk on your dashboard to add items and start tracking stock.</div>"
    elif total_stock == 0:
        low_stock_html = "<div style='color: #dc2626; font-size: 13.5px; padding: 24px; text-align: center; border: 1px dashed #fecaca; border-radius: 8px; background-color: #fef2f2; font-weight: 500;'>All registered catalog items are currently out of stock.</div>"
    elif low_stock_items:
        rows = []
        for item in low_stock_items[:5]:
            rows.append(f"""
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px 16px; font-weight: 500; color: #0f172a; text-align: left; vertical-align: middle; word-break: break-word;">{item.get('name')}</td>
                <td style="padding: 12px 16px; color: #d97706; font-weight: 600; text-align: right; vertical-align: middle;">{item.get('stock')}</td>
                <td style="padding: 12px 16px; color: #64748b; text-align: right; vertical-align: middle;">{item.get('minimum_stock')}</td>
            </tr>
            """)
        low_stock_html = f"""
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-top: 12px; background-color: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.01);">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                <thead>
                    <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                        <th style="padding: 10px 16px; font-weight: 600; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; text-align: left;">Item (Branch)</th>
                        <th style="padding: 10px 16px; font-weight: 600; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; text-align: right; width: 80px;">Stock</th>
                        <th style="padding: 10px 16px; font-weight: 600; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; text-align: right; width: 100px;">Safety Limit</th>
                    </tr>
                </thead>
                <tbody>
                    {"".join(rows)}
                </tbody>
            </table>
        </div>
        """
    else:
        low_stock_html = "<div style='color: #15803d; font-size: 13.5px; padding: 14px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; font-weight: 500;'>All stock levels are healthy.</div>"
        
    # Format expiry section
    expiry_html = ""
    if total_products == 0:
        expiry_html = "<div style='color: #475569; font-size: 13.5px; padding: 24px; text-align: center; border: 1px dashed #e2e8f0; border-radius: 8px; background-color: #f8fafc; font-weight: 500;'>No products registered. Expiration tracking will activate once products are added.</div>"
    elif total_stock == 0:
        expiry_html = "<div style='color: #475569; font-size: 13.5px; padding: 24px; text-align: center; border: 1px dashed #e2e8f0; border-radius: 8px; background-color: #f8fafc; font-weight: 500;'>No items in stock to track for expiration.</div>"
    elif expiry_risk_items:
        rows = []
        for item in expiry_risk_items[:5]:
            rows.append(f"""
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px 16px; font-weight: 500; color: #0f172a; text-align: left; vertical-align: middle; word-break: break-word;">{item.get('name')}</td>
                <td style="padding: 12px 16px; color: #64748b; text-align: right; vertical-align: middle;">{item.get('expiry_date')}</td>
                <td style="padding: 12px 16px; color: #dc2626; font-weight: 600; text-align: right; vertical-align: middle;">{item.get('days_left')} days</td>
            </tr>
            """)
        expiry_html = f"""
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-top: 12px; background-color: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.01);">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                <thead>
                    <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                        <th style="padding: 10px 16px; font-weight: 600; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; text-align: left;">Item (Branch)</th>
                        <th style="padding: 10px 16px; font-weight: 600; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; text-align: right; width: 120px;">Expiry Date</th>
                        <th style="padding: 10px 16px; font-weight: 600; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; text-align: right; width: 90px;">Runway</th>
                    </tr>
                </thead>
                <tbody>
                    {"".join(rows)}
                </tbody>
            </table>
        </div>
        """
    else:
        expiry_html = "<div style='color: #15803d; font-size: 13.5px; padding: 14px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; font-weight: 500;'>No products approaching expiration.</div>"
        
    # Format recommendations
    recs_html = ""
    if recommendations:
        recs_list = []
        for rec in recommendations[:5]:
            recs_list.append(f"""
            <div style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #0f172a; padding: 16px; margin-bottom: 12px; border-radius: 8px;'>
                <p style='margin: 0; font-size: 13.5px; font-weight: 700; color: #0f172a; letter-spacing: -0.01em;'>{rec.get('title')}</p>
                <p style='margin: 6px 0 0 0; font-size: 13px; color: #475569; line-height: 1.55;'>{rec.get('text')}</p>
            </div>
            """)
        recs_html = "".join(recs_list)
    else:
        recs_html = "<p style='color: #64748b; font-size: 13px; font-style: italic;'>No new suggestions at this time.</p>"

    content_html = f"""
    <h1 style="margin-top: 0; margin-bottom: 4px; font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: -0.03em;">{business_name}</h1>
    <p style="font-size: 13px; color: #64748b; margin-top: 0; margin-bottom: 28px; font-weight: 500;">Weekly Business and Inventory Summary</p>
    
    <!-- Sales Performance Card (Stripe Clean Style) -->
    <div style="border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; padding: 24px; margin-bottom: 32px; box-shadow: 0 1px 2px rgba(0,0,0,0.01);">
        <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; display: block; margin-bottom: 16px;">7-Day Performance</span>
        <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 0;">
            <tr>
                <td class="col-stack" style="width: 50%; vertical-align: top; padding: 0 16px 0 0; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    <span style="font-size: 28px; font-weight: 800; color: #0f172a; display: block; letter-spacing: -0.04em; line-height: 1;">₹{sales_revenue:,.2f}</span>
                    <span style="display: block; font-size: 12px; color: #64748b; margin-top: 8px; font-weight: 500;">Gross Revenue</span>
                </td>
                <td class="col-stack border-left-mobile" style="width: 50%; vertical-align: top; border-left: 1px solid #e2e8f0; padding: 0 0 0 24px; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    <span style="font-size: 28px; font-weight: 800; color: #0f172a; display: block; letter-spacing: -0.03em; line-height: 1;">{sales_count}</span>
                    <span style="display: block; font-size: 12px; color: #64748b; margin-top: 8px; font-weight: 500;">Transactions</span>
                </td>
            </tr>
        </table>
    </div>
    
    <!-- Stock Alerts -->
    <div style="margin-bottom: 28px;">
        <h2 style="font-size: 11px; font-weight: 700; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; color: #475569; margin-top: 0; text-transform: uppercase; letter-spacing: 0.06em;">Stock Alerts</h2>
        <div style="margin-top: 12px;">
            {low_stock_html}
        </div>
    </div>
    
    <!-- Expiration Warnings -->
    <div style="margin-bottom: 28px;">
        <h2 style="font-size: 11px; font-weight: 700; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; color: #475569; margin-top: 0; text-transform: uppercase; letter-spacing: 0.06em;">Upcoming Expirations</h2>
        <div style="margin-top: 12px;">
            {expiry_html}
        </div>
    </div>
    
    <!-- Recommendations -->
    <div style="margin-bottom: 32px;">
        <h2 style="font-size: 11px; font-weight: 700; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; color: #475569; margin-top: 0; text-transform: uppercase; letter-spacing: 0.06em;">Strategic Recommendations</h2>
        <div style="margin-top: 12px;">
            {recs_html}
        </div>
    </div>
    
    <div>
        <a href="{FRONTEND_URL}" class="btn" style="display: block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; font-weight: 600; border-radius: 6px; font-size: 13.5px; text-align: center; border: 1px solid #0f172a; box-sizing: border-box; width: 100%;">View Dashboard Analytics</a>
    </div>
    """
    html_content = get_email_base_layout(f"Executive Summary: {business_name}", "Executive Report", "#0f172a", content_html)
    await send_email([owner_email], f"Executive Summary: {business_name}", html_content)


async def send_eod_report_email(owner_email: str, first_name: str, business_name: str, stats: dict):
    """Send End of Day (EOD) daily report email to business owner."""
    sales_revenue = stats.get("sales_revenue", 0.0)
    sales_count = stats.get("sales_count", 0)
    average_ticket = stats.get("average_ticket", 0.0)
    items_sold_list = stats.get("items_sold_list", [])
    low_stock_items = stats.get("low_stock_items", [])
    expiry_risk_items = stats.get("expiry_risk_items", [])
    insights = stats.get("insights", [])
    
    total_products = stats.get("total_products_count", 0)
    total_stock = stats.get("total_stock_qty", 0.0)
    
    # Format today's sales breakdown
    sales_breakdown_html = ""
    if not items_sold_list:
        sales_breakdown_html = "<div style='color: #475569; font-size: 13.5px; padding: 24px; text-align: center; border: 1px dashed #e2e8f0; border-radius: 8px; background-color: #f8fafc; font-weight: 500;'>No sales recorded today. Open the POS billing desk to record transactions.</div>"
    else:
        rows = []
        for item in items_sold_list[:10]: # Limit to top 10 items for email density
            rows.append(f"""
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px 16px; font-weight: 500; color: #0f172a; text-align: left; vertical-align: middle; word-break: break-word;">{item.get('name')}</td>
                <td style="padding: 12px 16px; color: #475569; text-align: right; vertical-align: middle; width: 60px;">{item.get('qty')}</td>
                <td style="padding: 12px 16px; color: #0f172a; font-weight: 600; text-align: right; vertical-align: middle; width: 100px;">₹{item.get('revenue'):,.2f}</td>
            </tr>
            """)
        sales_breakdown_html = f"""
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-top: 12px; background-color: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.01);">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                <thead>
                    <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                        <th style="padding: 10px 16px; font-weight: 600; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; text-align: left;">Product</th>
                        <th style="padding: 10px 16px; font-weight: 600; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; text-align: right; width: 60px;">Qty</th>
                        <th style="padding: 10px 16px; font-weight: 600; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; text-align: right; width: 100px;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {"".join(rows)}
                </tbody>
            </table>
        </div>
        """
        
    # Format low stock section
    low_stock_html = ""
    if total_products == 0:
        low_stock_html = "<div style='color: #475569; font-size: 13.5px; padding: 20px; text-align: center; border: 1px dashed #e2e8f0; border-radius: 8px; background-color: #f8fafc; font-weight: 500;'>No products registered.</div>"
    elif low_stock_items:
        rows = []
        for item in low_stock_items[:5]:
            rows.append(f"""
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 16px; font-weight: 500; color: #0f172a; text-align: left; vertical-align: middle; word-break: break-word;">{item.get('name')}</td>
                <td style="padding: 10px 16px; color: #d97706; font-weight: 600; text-align: right; vertical-align: middle;">{item.get('stock')}</td>
                <td style="padding: 10px 16px; color: #64748b; text-align: right; vertical-align: middle;">{item.get('minimum_stock')}</td>
            </tr>
            """)
        low_stock_html = f"""
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-top: 12px; background-color: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.01);">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                <thead>
                    <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                        <th style="padding: 8px 16px; font-weight: 600; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; text-align: left;">Item (Branch)</th>
                        <th style="padding: 8px 16px; font-weight: 600; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; text-align: right; width: 65px;">Stock</th>
                        <th style="padding: 8px 16px; font-weight: 600; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; text-align: right; width: 90px;">Safety Limit</th>
                    </tr>
                </thead>
                <tbody>
                    {"".join(rows)}
                </tbody>
            </table>
        </div>
        """
    else:
        low_stock_html = "<div style='color: #15803d; font-size: 13px; padding: 12px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; font-weight: 500;'>All stock levels are healthy.</div>"

    # Format expiry section
    expiry_html = ""
    if total_products == 0:
        expiry_html = "<div style='color: #475569; font-size: 13.5px; padding: 20px; text-align: center; border: 1px dashed #e2e8f0; border-radius: 8px; background-color: #f8fafc; font-weight: 500;'>No products registered.</div>"
    elif expiry_risk_items:
        rows = []
        for item in expiry_risk_items[:5]:
            rows.append(f"""
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 16px; font-weight: 500; color: #0f172a; text-align: left; vertical-align: middle; word-break: break-word;">{item.get('name')}</td>
                <td style="padding: 10px 16px; color: #64748b; text-align: right; vertical-align: middle;">{item.get('expiry_date')}</td>
                <td style="padding: 10px 16px; color: #dc2626; font-weight: 600; text-align: right; vertical-align: middle;">{item.get('days_left')} days</td>
            </tr>
            """)
        expiry_html = f"""
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-top: 12px; background-color: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.01);">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                <thead>
                    <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                        <th style="padding: 8px 16px; font-weight: 600; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; text-align: left;">Item (Branch)</th>
                        <th style="padding: 8px 16px; font-weight: 600; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; text-align: right; width: 110px;">Expiry Date</th>
                        <th style="padding: 8px 16px; font-weight: 600; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; text-align: right; width: 85px;">Runway</th>
                    </tr>
                </thead>
                <tbody>
                    {"".join(rows)}
                </tbody>
            </table>
        </div>
        """
    else:
        expiry_html = "<div style='color: #15803d; font-size: 13px; padding: 12px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; font-weight: 500;'>No items approaching expiration.</div>"

    # Format insights
    insights_html = ""
    if insights:
        insights_list = []
        for ins in insights[:5]:
            insights_list.append(f"""
            <div style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #0f172a; padding: 14px; margin-bottom: 12px; border-radius: 8px;'>
                <p style='margin: 0; font-size: 13.5px; font-weight: 700; color: #0f172a; letter-spacing: -0.01em;'>{ins.get('title')}</p>
                <p style='margin: 4px 0 0 0; font-size: 13px; color: #475569; line-height: 1.5;'>{ins.get('text')}</p>
            </div>
            """)
        insights_html = "".join(insights_list)
    else:
        insights_html = "<p style='color: #64748b; font-size: 13px; font-style: italic;'>No daily insights generated at this time.</p>"

    content_html = f"""
    <h1 style="margin-top: 0; margin-bottom: 4px; font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: -0.03em;">{business_name}</h1>
    <p style="font-size: 13px; color: #64748b; margin-top: 0; margin-bottom: 28px; font-weight: 500;">End of Day Sales & Inventory Report</p>
    
    <!-- Today's Performance Card (Stripe Clean Style) -->
    <div style="border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; padding: 24px; margin-bottom: 32px; box-shadow: 0 1px 2px rgba(0,0,0,0.01);">
        <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; display: block; margin-bottom: 16px;">Today's Summary</span>
        <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 0;">
            <tr>
                <td class="col-stack" style="width: 50%; vertical-align: top; padding: 0 16px 0 0; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    <span style="font-size: 30px; font-weight: 800; color: #0f172a; display: block; letter-spacing: -0.04em; line-height: 1;">₹{sales_revenue:,.2f}</span>
                    <span style="display: block; font-size: 12px; color: #64748b; margin-top: 8px; font-weight: 500;">Gross Revenue</span>
                </td>
                <td class="col-stack border-left-mobile" style="width: 50%; vertical-align: top; border-left: 1px solid #e2e8f0; padding: 0 0 0 24px; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    <span style="font-size: 24px; font-weight: 800; color: #0f172a; display: block; letter-spacing: -0.03em; line-height: 1.1; margin-bottom: 2px;">{sales_count}</span>
                    <span style="display: block; font-size: 11px; color: #64748b; font-weight: 500; margin-bottom: 8px;">Transactions</span>
                    
                    <span style="font-size: 18px; font-weight: 700; color: #334155; display: block; letter-spacing: -0.02em; line-height: 1.1; margin-top: 8px;">₹{average_ticket:,.2f}</span>
                    <span style="display: block; font-size: 11px; color: #64748b; font-weight: 500;">Average Ticket</span>
                </td>
            </tr>
        </table>
    </div>
    
    <!-- Today's Sales Breakdown -->
    <div style="margin-bottom: 28px;">
        <h2 style="font-size: 11px; font-weight: 700; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; color: #475569; margin-top: 0; text-transform: uppercase; letter-spacing: 0.06em;">Today's Billing</h2>
        <div style="margin-top: 12px;">
            {sales_breakdown_html}
        </div>
    </div>
    
    <!-- Stock Alerts -->
    <div style="margin-bottom: 28px;">
        <h2 style="font-size: 11px; font-weight: 700; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; color: #475569; margin-top: 0; text-transform: uppercase; letter-spacing: 0.06em;">Current Stock Alerts</h2>
        <div style="margin-top: 12px;">
            {low_stock_html}
        </div>
    </div>
    
    <!-- Expiration Warnings -->
    <div style="margin-bottom: 28px;">
        <h2 style="font-size: 11px; font-weight: 700; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; color: #475569; margin-top: 0; text-transform: uppercase; letter-spacing: 0.06em;">Current Expirations</h2>
        <div style="margin-top: 12px;">
            {expiry_html}
        </div>
    </div>
    
    <!-- Daily Insights -->
    <div style="margin-bottom: 32px;">
        <h2 style="font-size: 11px; font-weight: 700; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; color: #475569; margin-top: 0; text-transform: uppercase; letter-spacing: 0.06em;">EOD Strategic Insights</h2>
        <div style="margin-top: 12px;">
            {insights_html}
        </div>
    </div>
    
    <div>
        <a href="{FRONTEND_URL}/billing-pos" class="btn" style="display: block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; font-weight: 600; border-radius: 6px; font-size: 13.5px; text-align: center; border: 1px solid #0f172a; box-sizing: border-box; width: 100%;">Launch POS Billing Terminal</a>
    </div>
    """
    html_content = get_email_base_layout(f"End of Day Report: {business_name}", "Daily Report", "#0f172a", content_html)
    await send_email([owner_email], f"End of Day Report: {business_name}", html_content)

