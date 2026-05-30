# Razorpay Payment Integration - Implementation Guide

## Overview
Complete Razorpay payment integration for Inventra platform with support for:
- One-time payments
- Subscriptions
- Refund processing
- Invoice generation
- Webhook handling
- Email notifications

---

## Backend Implementation

### 1. **Files Created**

#### Service Layer
- **`app/services/payment_service.py`** (NEW)
  - RazorpayPaymentService class
  - Payment order creation
  - Signature verification
  - Refund processing
  - Invoice generation

#### API Routes
- **`app/routes/payment.py`** (NEW)
  - `POST /api/payments/initiate` - Start payment
  - `POST /api/payments/verify` - Verify payment signature
  - `POST /api/payments/{transaction_id}/refund` - Process refund
  - `GET /api/payments/{transaction_id}/invoice` - Generate invoice
  - `GET /api/payments/branch/{branch_id}` - Get transaction history
  - `POST /api/payments/webhook` - Razorpay webhook handler

#### Models & Schemas
- **`app/models/schemas.py`** (UPDATED)
  - Added payment-related Pydantic models:
    - `PaymentStatus` enum
    - `PaymentMethod` enum
    - `OrderItem` model
    - `PaymentInitiateRequest/Response`
    - `PaymentVerifyRequest/Response`
    - `RefundRequest/Response`
    - `TransactionRecord`
    - `InvoiceData`

#### Configuration Files
- **`backend/.env`** (UPDATED)
  - Added Razorpay credentials
  - Added business email and invoice prefix
  - Added frontend URL

- **`backend/requirements.txt`** (UPDATED)
  - Added: `razorpay`, `requests`, `reportlab`, `jinja2`, `aiosmtplib`

- **`backend/main.py`** (UPDATED)
  - Added payment router import
  - Registered payment routes

### 2. **Setup Steps**

#### Step 1: Install Backend Dependencies
```bash
cd backend
pip install -r requirements.txt
```

#### Step 2: Verify Environment Variables
Check `.env` file contains:
```
RAZORPAY_KEY_ID=rzp_test_SuLnp2neZuqfWA
RAZORPAY_KEY_SECRET=7FcAG40a0O2s11BBeABQPddP
BUSINESS_EMAIL=mshaikh191103@gmail.com
INVOICE_PREFIX=INV
```

#### Step 3: Create MongoDB Indexes (Optional but Recommended)
```javascript
db.payments.createIndex({ "business_id": 1, "created_at": -1 })
db.payments.createIndex({ "transaction_id": 1 }, { unique: true })
db.payments.createIndex({ "razorpay_order_id": 1 }, { unique: true })
db.payments.createIndex({ "razorpay_payment_id": 1 }, { unique: true })
```

#### Step 4: Test Backend
```bash
python -m uvicorn main:app --reload
# Visit: http://localhost:8000/docs
```

---

## Frontend Implementation

### 1. **Files Created**

#### Utilities
- **`src/utils/payments.js`** (NEW)
  - Payment API functions
  - Razorpay script loader
  - Checkout opener
  - Complete payment flow orchestrator

#### Components
- **`src/components/paymentModal.jsx`** (NEW)
  - Payment checkout modal
  - Customer info form
  - Razorpay checkout integration
  - Error handling

- **`src/components/invoiceViewer.jsx`** (NEW)
  - Invoice display
  - Print functionality
  - Download functionality

#### Configuration Files
- **`frontend/package.json`** (UPDATED)
  - Added: `axios`, `razorpay`

### 2. **Setup Steps**

#### Step 1: Install Frontend Dependencies
```bash
cd frontend
npm install
```

#### Step 2: Create `.env.local` (Optional for custom Razorpay Key)
```
VITE_RAZORPAY_KEY_ID=rzp_test_SuLnp2neZuqfWA
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

#### Step 3: Update `billingPos.jsx` to Use Payment Modal
```jsx
import PaymentModal from "../components/paymentModal";
import { useState } from "react";

export default function BillingPOS() {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);

  const handleCheckout = () => {
    setPendingOrder({
      amount: totalAmount,
      description: "Inventra Order",
      items: cartItems
    });
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSuccess = (result) => {
    // Update order status, save invoice, etc.
    console.log("Payment successful:", result);
  };

  return (
    <>
      {/* Your existing billing UI */}
      <button onClick={handleCheckout}>Proceed to Payment</button>

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={handlePaymentSuccess}
        amount={pendingOrder?.amount || 0}
        description={pendingOrder?.description || ""}
        items={pendingOrder?.items || []}
      />
    </>
  );
}
```

---

## Database Schema

### MongoDB Collection: `payments`

```javascript
{
  _id: ObjectId,
  transaction_id: String (unique),
  business_id: ObjectId,
  branch_id: String,
  user_id: String,
  
  // Razorpay References
  razorpay_order_id: String (unique),
  razorpay_payment_id: String (unique),
  
  // Amount Details
  amount: Number,
  currency: String = "INR",
  status: String, // pending, completed, failed, refunded, cancelled
  payment_method: String, // card, netbanking, wallet, upi, etc.
  
  // Customer Information
  customer_name: String,
  customer_email: String,
  customer_phone: String,
  
  // Order Details
  items: [
    {
      product_id: String,
      product_name: String,
      quantity: Number,
      price: Number,
      gst_percentage: Number,
      total: Number
    }
  ],
  
  // Invoice Information
  receipt_number: String,
  invoice_url: String,
  
  // Refund Information
  refund_id: String,
  refund_amount: Number,
  refund_reason: String,
  
  // Metadata
  description: String,
  metadata: Object,
  created_at: ISODate,
  updated_at: ISODate
}
```

---

## API Endpoints

### 1. Initiate Payment
**POST** `/api/payments/initiate`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "amount": 1000.00,
  "description": "Order #12345",
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "customer_phone": "9876543210",
  "branch_id": "BR001",
  "items": [
    {
      "product_id": "PRD001",
      "product_name": "Product A",
      "quantity": 2,
      "price": 500.00,
      "gst_percentage": 18.0,
      "total": 1000.00
    }
  ]
}
```

**Response:**
```json
{
  "order_id": "ORD_123456789",
  "razorpay_order_id": "order_1234567890ABCD",
  "amount": 1000.00,
  "currency": "INR",
  "timeout": 900
}
```

### 2. Verify Payment
**POST** `/api/payments/verify`

**Request Body:**
```json
{
  "razorpay_order_id": "order_1234567890ABCD",
  "razorpay_payment_id": "pay_1234567890ABCD",
  "razorpay_signature": "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d",
  "order_id": "ORD_123456789"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "transaction_id": "ORD_123456789",
  "amount": 1000.00,
  "payment_id": "pay_1234567890ABCD"
}
```

### 3. Request Refund
**POST** `/api/payments/{transaction_id}/refund`

**Request Body:**
```json
{
  "refund_amount": 500.00,
  "reason": "Customer requested cancellation"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Refund processed successfully",
  "refund_id": "rfnd_1234567890ABCD",
  "refund_amount": 500.00
}
```

### 4. Get Invoice
**GET** `/api/payments/{transaction_id}/invoice`

**Response:** HTML invoice document

### 5. Get Transaction History
**GET** `/api/payments/branch/{branch_id}?skip=0&limit=50`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "transaction_id": "ORD_123456789",
      "amount": 1000.00,
      "status": "completed",
      "customer_email": "john@example.com",
      "created_at": "2024-05-27T10:30:00Z",
      ...
    }
  ],
  "total": 150
}
```

### 6. Webhook Handler
**POST** `/api/payments/webhook`

**Headers:**
```
X-Razorpay-Signature: {signature}
Content-Type: application/json
```

**Supported Events:**
- `payment.authorized` - Payment successful
- `payment.failed` - Payment failed
- `refund.completed` - Refund completed

---

## Frontend Components Usage

### paymentModal
```jsx
import PaymentModal from "./components/paymentModal";
import { useState } from "react";

function App() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        Checkout
      </button>

      <PaymentModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={(result) => {
          console.log("Payment successful:", result);
        }}
        amount={1000}
        description="Order #12345"
        items={[
          {
            product_name: "Product A",
            quantity: 2,
            price: 500,
            total: 1000,
            gst_percentage: 18
          }
        ]}
        branchId="BR001"
      />
    </>
  );
}
```

### invoiceViewer
```jsx
import InvoiceViewer from "./components/invoiceViewer";
import { useState } from "react";

function TransactionDetail() {
  const [showInvoice, setShowInvoice] = useState(false);

  return (
    <>
      <button onClick={() => setShowInvoice(true)}>
        View Invoice
      </button>

      <InvoiceViewer
        transactionId="ORD_123456789"
        isOpen={showInvoice}
        onClose={() => setShowInvoice(false)}
      />
    </>
  );
}
```

---

## Payment Utility Functions

### Initiate Payment
```javascript
import { initiatePayment } from "./utils/payments";

const order = await initiatePayment({
  amount: 1000,
  description: "Order #12345",
  customer_email: "john@example.com",
  customer_phone: "9876543210",
  items: [...]
});
```

### Process Complete Payment Flow
```javascript
import { processPayment } from "./utils/payments";

const result = await processPayment(
  {
    amount: 1000,
    description: "Order #12345",
    customer_email: "john@example.com",
    customer_phone: "9876543210",
    items: [...]
  },
  {
    name: "John Doe",
    email: "john@example.com",
    contact: "9876543210"
  }
);

console.log(result.transaction_id); // Use for invoice, etc.
```

### Get and Download Invoice
```javascript
import { downloadInvoice, printInvoice } from "./utils/payments";

// Download as HTML
await downloadInvoice("ORD_123456789", "invoice.html");

// Or print directly
await printInvoice("ORD_123456789");
```

### Get Transaction History
```javascript
import { getBranchTransactionHistory } from "./utils/payments";

const history = await getBranchTransactionHistory("BR001", 0, 50);
console.log(history.data); // Array of transactions
```

---

## Testing Guide

### 1. Test Cards (Razorpay Test Mode)
```
Success: 4111 1111 1111 1111 (or any Visa test card)
Failed: 4444 3333 2222 1111 (or any failed test card)
Expiry: Any future date (e.g., 12/25)
CVV: Any 3 digits (e.g., 123)
OTP: 000000
```

### 2. Test Refunds
```bash
# Initiate payment (complete successfully)
# Then request refund with:
POST /api/payments/{transaction_id}/refund
{
  "refund_amount": 100,
  "reason": "Testing refund"
}
```

### 3. Test Webhooks (Local)
```bash
# Use ngrok to expose local API
ngrok http 8000

# Configure webhook in Razorpay Dashboard:
# URL: https://your-ngrok-url/api/v1/payments/webhook
# Events: payment.authorized, payment.failed, refund.completed
```

---

## Razorpay Dashboard Configuration

### 1. API Keys
- Go to Settings → API Keys
- Keep Key ID and Key Secret secure
- Never commit them to version control

### 2. Webhook Configuration
- Go to Settings → Webhooks
- Add endpoint: `https://yourdomain.com/api/v1/payments/webhook`
- Select events:
  - `payment.authorized`
  - `payment.failed`
  - `refund.completed`
  - `refund.failed`
- Save and test webhook

### 3. Business Details
- Fill business information in Settings
- Enable invoicing if needed
- Configure email templates

---

## Security Best Practices

1. **Never expose Razorpay Key Secret**
   - Keep only on backend
   - Use environment variables
   - Rotate periodically

2. **Verify Signatures**
   - Always verify Razorpay signatures
   - Prevent replay attacks
   - Use HTTPS only

3. **Data Validation**
   - Validate amounts on backend
   - Check user permissions
   - Prevent SQL injection / NoSQL injection

4. **PCI DSS Compliance**
   - Never handle raw card data
   - Use Razorpay Elements
   - Implement HTTPS
   - Log securely

5. **Rate Limiting**
   - Add rate limiting to payment endpoints
   - Prevent brute force attacks
   - Monitor for suspicious activity

---

## Troubleshooting

### Issue: "Missing or invalid Authorization header"
**Solution:** Ensure JWT token is valid and not expired. Re-login if needed.

### Issue: "Invalid payment signature"
**Solution:** Verify that Razorpay Key Secret is correct in `.env`

### Issue: "Order not found in database"
**Solution:** Check MongoDB connection and ensure payment initiation succeeded

### Issue: "Razorpay script not loaded"
**Solution:** Ensure `loadRazorpayScript()` is called before opening checkout

### Issue: "Invoice generation failed"
**Solution:** Check business details in Razorpay account and ensure items are properly formatted

---

## Production Checklist

- [ ] Obtain production Razorpay API keys
- [ ] Update `.env` with production keys
- [ ] Configure HTTPS for all endpoints
- [ ] Set up webhook endpoint
- [ ] Test end-to-end payment flow
- [ ] Configure email notifications
- [ ] Set up logging and monitoring
- [ ] Test refund process
- [ ] Verify invoice generation
- [ ] Test with actual credit/debit cards
- [ ] Update frontend to use production Razorpay key
- [ ] Review security configurations
- [ ] Set up backup payment methods
- [ ] Configure rate limiting
- [ ] Test error handling scenarios
- [ ] Deploy and verify in production

---

## Support & Documentation

- **Razorpay Docs:** https://razorpay.com/docs/
- **Razorpay Dashboard:** https://dashboard.razorpay.com/
- **API Reference:** https://razorpay.com/docs/api/
- **Payment Gateway:** https://razorpay.com/docs/payment-gateway/

---

## Next Steps

1. Install all dependencies
2. Configure environment variables
3. Test payment flow in sandbox
4. Update BillingPOS component to use PaymentModal
5. Add transaction history to dashboard
6. Configure webhooks
7. Deploy to staging environment
8. Obtain production API keys
9. Deploy to production
10. Monitor and optimize
