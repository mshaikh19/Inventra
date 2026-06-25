import os
import re
import logging
import asyncio
import requests
from typing import Optional

logger = logging.getLogger(__name__)

def normalize_phone_number(phone: str) -> Optional[str]:
    """
    Normalizes a phone number into E.164 format (+[country code][number]).
    - Strips all non-digit characters except for a leading plus sign.
    - If the number is exactly 10 digits, defaults to prefixing '+91' (India).
    - If the number starts with '91' and is 12 digits, prefixes '+'.
    - Ensures the final result starts with '+' followed by digits.
    """
    if not phone:
        return None
        
    cleaned = str(phone).strip()
    
    # Check if it has a leading '+'
    has_plus = cleaned.startswith("+")
    
    # Strip all non-digit characters
    digits = re.sub(r"\D", "", cleaned)
    
    if not digits:
        return None
        
    # If exactly 10 digits, assume India (+91)
    if len(digits) == 10:
        return f"+91{digits}"
        
    # If 12 digits and starts with 91, it is already prefixed with country code but needs '+'
    if len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
        
    # If there was a leading plus or it's a longer/shorter number, just return '+' + digits
    if has_plus or len(digits) > 10:
        return f"+{digits}"
        
    # Default fallback
    return f"+{digits}"


def send_sms_sync(recipient: str, content: str, api_key: Optional[str] = None, sender: Optional[str] = None) -> bool:
    """
    Synchronous helper to dispatch transactional SMS via Brevo API.
    Runs inside a threadpool via asyncio.to_thread.
    """
    # Normalize phone number
    normalized_recipient = normalize_phone_number(recipient)
    if not normalized_recipient:
        logger.error(f"[SMS-UTIL] Invalid phone number provided: {recipient}")
        return False

    # Load credentials: use business-specific first, then fall back to env
    active_key = api_key
    if not active_key:
        active_key = os.getenv("BREVO_API_KEY", "").strip()
    
    # Smart fallback: if active_key is empty, check if SMTP_PASSWORD contains a Brevo API Key (xsmtpsib-...)
    if not active_key:
        smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()
        if smtp_pass.startswith("xsmtpsib-"):
            active_key = smtp_pass
            logger.info("[SMS-UTIL] BREVO_API_KEY not set. Automatically falling back to SMTP_PASSWORD api-key credentials.")

    if not active_key:
        logger.warning("[SMS-UTIL] Brevo API Key not configured. SMS dispatch aborted.")
        return False

    active_sender = sender
    if not active_sender:
        active_sender = os.getenv("BREVO_SMS_SENDER", "Inventra").strip()
        
    # Brevo allows alphanumeric senders of max 11 characters
    if len(active_sender) > 11:
        active_sender = active_sender[:11]

    url = "https://api.brevo.com/v3/transactionalSMS/sms"
    headers = {
        "api-key": active_key,
        "content-type": "application/json",
        "accept": "application/json"
    }
    payload = {
        "sender": active_sender,
        "recipient": normalized_recipient,
        "content": content,
        "type": "transactional"
    }

    try:
        logger.info(f"[SMS-UTIL] Initiating SMS dispatch to {normalized_recipient} via Brevo...")
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        
        if response.status_code in (200, 201):
            res_data = response.json()
            logger.info(f"[SMS-UTIL] SMS successfully sent to {normalized_recipient}. Message ID: {res_data.get('messageId')}")
            return True
        else:
            logger.error(
                f"[SMS-UTIL] Brevo API returned error status {response.status_code}. "
                f"Response: {response.text}"
            )
            return False
            
    except requests.exceptions.RequestException as e:
        logger.error(f"[SMS-UTIL] Connection error during Brevo SMS dispatch: {e}")
        return False
    except Exception as e:
        logger.error(f"[SMS-UTIL] Unexpected error during Brevo SMS dispatch: {e}")
        return False


async def send_sms(recipient: str, content: str, db=None, business_id: Optional[str] = None) -> bool:
    """
    Asynchronously sends a transactional SMS to a recipient using Brevo.
    Executes in a threadpool to prevent blocking the async event loop.
    Supports Bring Your Own Key (BYOK) database lookups for business tenants.
    """
    api_key = None
    sender = None
    
    if db is not None and business_id:
        try:
            from bson import ObjectId
            # Query the businesses collection for tenant-specific SMS settings
            bus_query = {"_id": ObjectId(business_id) if ObjectId.is_valid(str(business_id)) else business_id}
            business = await db.businesses.find_one(bus_query)
            
            if business:
                prov = business.get("smsProvider") or "none"
                key = (business.get("smsApiKey") or "").strip()
                snd = (business.get("smsSender") or "").strip()
                
                if prov == "brevo" and key:
                    api_key = key
                    sender = snd
                    logger.info(f"[SMS-UTIL] Resolved custom tenant-level Brevo credentials for business: {business.get('name')} ({business_id})")
        except Exception as err:
            logger.warning(f"[SMS-UTIL] Failed to look up tenant SMS settings for business {business_id}: {err}")
            
    return await asyncio.to_thread(send_sms_sync, recipient, content, api_key=api_key, sender=sender)
