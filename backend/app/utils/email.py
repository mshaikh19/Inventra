import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests
import os
import logging
from typing import List, Optional
from bson import ObjectId

EMAIL_SERVICE = os.getenv("EMAIL_SERVICE", "resend")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "no-reply@inventra.com")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

async def send_email(to_emails: List[str], subject: str, html_content: str):
    if not to_emails:
        return
    
    if EMAIL_SERVICE == "resend" and RESEND_API_KEY:
        await _send_resend(to_emails, subject, html_content)
    elif SMTP_USERNAME and SMTP_PASSWORD:
        await _send_smtp(to_emails, subject, html_content)
    else:
        logging.warning("Email service is not configured (missing RESEND_API_KEY or SMTP credentials)")
        # Print for local development testing
        print("\n=== [DEVELOPMENT] OUTGOING EMAIL ===")
        print(f"To: {to_emails}")
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
        "from": f"Inventra Alerts <{SMTP_FROM}>",
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
        msg['From'] = SMTP_FROM
        msg['To'] = ", ".join(to_emails)
        
        part = MIMEText(html_content, 'html')
        msg.attach(part)
        
        import asyncio
        loop = asyncio.get_event_loop()
        
        def _blocking_send():
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
                server.sendmail(SMTP_FROM, to_emails, msg.as_string())
                
        await loop.run_in_executor(None, _blocking_send)
    except Exception as e:
        logging.error(f"SMTP email dispatch failed: {e}")

async def send_welcome_email(user_email: str, first_name: str):
    html_content = f"""
    <div style="font-family: sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #0ea5e9; margin-top: 0;">Welcome to Inventra, {first_name}! 🚀</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
            Thank you for joining our Retail Intelligence platform. We are excited to help you transform your business operations with predictive AI.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
            Log in to your dashboard to set up your branch networks, list your inventory, and configure your POS system.
        </p>
        <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
            <a href="http://localhost:5173" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 10px 20px; font-weight: bold; border-radius: 8px; font-size: 13px;">Go to Dashboard</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
        <p style="font-size: 11px; color: #64748b; margin: 0;">If you have any questions, feel free to reply directly to this email.</p>
    </div>
    """
    await send_email([user_email], "Welcome to Inventra! 🚀", html_content)

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
            "isDeleted": {"$ne": True}
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
            "low-stock": "#F59E0B",
            "expiry": "#EF4444",
            "payment": "#10B981"
        }
        color = color_map.get(alert_type, "#0EA5E9")
        
        html_content = f"""
        <div style="font-family: sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="display: flex; align-items: center; margin-bottom: 20px;">
                <span style="display: inline-block; width: 12px; height: 12px; background-color: {color}; border-radius: 50%; margin-right: 8px;"></span>
                <h2 style="margin: 0; color: #0f172a; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">{alert_title}</h2>
            </div>
            <div style="background-color: #f8fafc; border-left: 4px solid {color}; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14px; font-weight: 600; line-height: 1.6; color: #334155;">{alert_text}</p>
            </div>
            <p style="font-size: 13.5px; line-height: 1.5; color: #475569;">
                This email alert was automatically generated by Inventra Retail Intelligence. Please log in to your dashboard to review stock levels, trigger procurement reorders, or manage allocations.
            </p>
            <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
                <a href="http://localhost:5173" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 10px 20px; font-weight: bold; border-radius: 8px; font-size: 13px;">Go to Dashboard</a>
            </div>
        </div>
        """
        
        await send_email(to_emails, f"Inventra Alert: {alert_title}", html_content)
    except Exception as e:
        logging.error(f"Failed to generate/send alert email: {e}")

async def send_password_reset_email(user_email: str, first_name: str, token: str):
    reset_link = f"{FRONTEND_URL}/forgot?token={token}"
    html_content = f"""
    <div style="font-family: sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #0ea5e9; margin-top: 0;">Reset Your Password 🔐</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
            Hello {first_name},
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
            We received a request to reset the password for your Inventra account. Click the button below to choose a new password. This link is valid for 60 minutes.
        </p>
        <div style="margin-top: 28px; padding-top: 20px; text-align: center;">
            <a href="{reset_link}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 10px 20px; font-weight: bold; border-radius: 8px; font-size: 13px;">Reset Password</a>
        </div>
        <p style="font-size: 12px; line-height: 1.6; color: #64748b; margin-top: 28px;">
            If the button above does not work, copy and paste the following URL into your browser:
            <br />
            <a href="{reset_link}" style="color: #0ea5e9;">{reset_link}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
        <p style="font-size: 11px; color: #64748b; margin: 0;">If you did not request a password reset, you can safely ignore this email.</p>
    </div>
    """
    await send_email([user_email], "Reset your Inventra password", html_content)


async def send_employee_setup_email(employee_email: str, first_name: str, business_name: str, role: str):
    login_link = f"{FRONTEND_URL}/login"
    html_content = f"""
    <div style="font-family: sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #0ea5e9; margin-top: 0;">Welcome to the Team! 🎉</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
            Hello {first_name},
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
            Your staff account has been successfully set up for <strong>{business_name}</strong> on the Inventra Retail Intelligence portal.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
            <strong>Your Assigned Role:</strong> {role.replace('_', ' ').title()}
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
            You can access the portal and sign in with your email address. We highly recommend updating your temporary password upon logging in.
        </p>
        <div style="margin-top: 28px; padding-top: 20px; text-align: center;">
            <a href="{login_link}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 10px 20px; font-weight: bold; border-radius: 8px; font-size: 13px;">Login to Portal</a>
        </div>
        <p style="font-size: 12px; line-height: 1.6; color: #64748b; margin-top: 28px;">
            If the button above does not work, copy and paste the following URL into your browser:
            <br />
            <a href="{login_link}" style="color: #0ea5e9;">{login_link}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
        <p style="font-size: 11px; color: #64748b; margin: 0;">This is an automated notification. If you believe this was sent in error, please contact your manager.</p>
    </div>
    """
    await send_email([employee_email], f"Welcome to the team at {business_name}!", html_content)
