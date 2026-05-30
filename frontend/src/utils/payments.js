/**
 * Payment API Utilities
 * Handles all communication with the backend payment APIs
 */

import axios from "axios";

const API_BASE_URL = "http://localhost:8000/api/v1"; // Update based on your backend URL

/**
 * Get the authorization token from localStorage or sessionStorage
 */
const getAuthToken = () => {
  const token = localStorage.getItem("inventra_token") || sessionStorage.getItem("inventra_token");
  return token ? `Bearer ${token}` : null;
};

/**
 * Create an axios instance with auth headers
 */
const createApiClient = () => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
  });

  // Add auth header to all requests
  client.interceptors.request.use((config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = token;
    }
    return config;
  });

  return client;
};

const apiClient = createApiClient();

/**
 * Initiate a new payment
 * @param {Object} paymentData - Payment details
 * @param {number} paymentData.amount - Amount in INR
 * @param {string} paymentData.description - Payment description
 * @param {string} paymentData.customer_email - Customer email
 * @param {string} paymentData.customer_phone - Customer phone
 * @param {string} [paymentData.customer_name] - Customer name
 * @param {string} [paymentData.branch_id] - Branch ID
 * @param {Array} [paymentData.items] - Order items
 * @returns {Promise<Object>} Order details with razorpay_order_id
 */
export const initiatePayment = async (paymentData) => {
  try {
    const response = await apiClient.post("/payments/initiate", paymentData);
    return response.data;
  } catch (error) {
    console.error("Error initiating payment:", error);
    throw error.response?.data || { error: error.message };
  }
};

/**
 * Verify payment after successful Razorpay payment
 * @param {Object} verificationData - Payment verification details
 * @param {string} verificationData.razorpay_order_id - Razorpay order ID
 * @param {string} verificationData.razorpay_payment_id - Razorpay payment ID
 * @param {string} verificationData.razorpay_signature - Razorpay signature
 * @param {string} verificationData.order_id - Internal order ID
 * @returns {Promise<Object>} Verification response
 */
export const verifyPayment = async (verificationData) => {
  try {
    const response = await apiClient.post("/payments/verify", verificationData);
    return response.data;
  } catch (error) {
    console.error("Error verifying payment:", error);
    throw error.response?.data || { error: error.message };
  }
};

/**
 * Request a refund for a completed payment
 * @param {string} transactionId - Transaction ID to refund
 * @param {Object} refundData - Refund details
 * @param {number} [refundData.refund_amount] - Refund amount (full if not specified)
 * @param {string} refundData.reason - Refund reason
 * @returns {Promise<Object>} Refund response
 */
export const requestRefund = async (transactionId, refundData) => {
  try {
    const response = await apiClient.post(`/payments/${transactionId}/refund`, refundData);
    return response.data;
  } catch (error) {
    console.error("Error processing refund:", error);
    throw error.response?.data || { error: error.message };
  }
};

/**
 * Get transaction details
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<Object>} Transaction details
 */
export const getTransactionDetails = async (transactionId) => {
  try {
    const response = await apiClient.get(`/payments/${transactionId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching transaction details:", error);
    throw error.response?.data || { error: error.message };
  }
};

/**
 * Get invoice for a transaction (returns HTML)
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<string>} Invoice HTML
 */
export const getInvoice = async (transactionId) => {
  try {
    const response = await apiClient.get(`/payments/${transactionId}/invoice`, {
      responseType: "text",
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching invoice:", error);
    throw error.response?.data || { error: error.message };
  }
};

/**
 * Download invoice as HTML (triggers download)
 * @param {string} transactionId - Transaction ID
 * @param {string} fileName - File name for download
 */
export const downloadInvoice = async (transactionId, fileName = "invoice.html") => {
  try {
    const invoiceHtml = await getInvoice(transactionId);
    const blob = new Blob([invoiceHtml], { type: "text/html" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading invoice:", error);
    throw error;
  }
};

/**
 * Print invoice
 * @param {string} transactionId - Transaction ID
 */
export const printInvoice = async (transactionId) => {
  try {
    const invoiceHtml = await getInvoice(transactionId);
    const printWindow = window.open("", "", "height=600,width=800");
    printWindow.document.write(invoiceHtml);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  } catch (error) {
    console.error("Error printing invoice:", error);
    throw error;
  }
};

/**
 * Get transaction history for a branch
 * @param {string} branchId - Branch ID
 * @param {number} skip - Number of records to skip
 * @param {number} limit - Number of records to fetch
 * @returns {Promise<Object>} Transaction history
 */
export const getBranchTransactionHistory = async (branchId, skip = 0, limit = 50) => {
  try {
    const response = await apiClient.get(`/payments/branch/${branchId}`, {
      params: { skip, limit },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching transaction history:", error);
    throw error.response?.data || { error: error.message };
  }
};

/**
 * Load Razorpay script dynamically
 * @returns {Promise<void>}
 */
export const loadRazorpayScript = () => {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = resolve;
    script.onerror = () => {
      reject(new Error("Failed to load Razorpay script"));
    };
    document.head.appendChild(script);
  });
};

/**
 * Open Razorpay checkout
 * @param {Object} razorpayConfig - Razorpay configuration object
 * @returns {Promise<void>}
 */
export const openRazorpayCheckout = (razorpayConfig) => {
  return new Promise((resolve, reject) => {
    try {
      const rzp = new window.Razorpay(razorpayConfig);
      rzp.on("payment.failed", (response) => {
        reject(new Error(response.error.description));
      });
      rzp.open();
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Complete payment process (initiate + open checkout)
 * @param {Object} paymentData - Payment details
 * @param {Object} userInfo - User info for Razorpay checkout
 * @param {string} userInfo.name - User name
 * @param {string} userInfo.email - User email
 * @param {string} userInfo.contact - User phone
 * @param {string} [userInfo.image] - Company logo URL
 * @returns {Promise<Object>} Payment result
 */
export const processPayment = async (paymentData, userInfo) => {
  try {
    // Step 1: Load Razorpay script
    await loadRazorpayScript();

    // Step 2: Initiate payment and get order ID
    const orderResponse = await initiatePayment(paymentData);

    if (!orderResponse.razorpay_order_id) {
      throw new Error("Failed to create payment order");
    }

    // Step 3: Get auth token for signature verification
    const token = getAuthToken();
    if (!token) {
      throw new Error("User not authenticated");
    }

    // Step 4: Open Razorpay checkout
    return new Promise((resolve, reject) => {
      const razorpayConfig = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_SuLnp2neZuqfWA",
        order_id: orderResponse.razorpay_order_id,
        amount: orderResponse.amount * 100, // Convert to paise
        currency: orderResponse.currency,
        name: userInfo.name || "Inventra",
        image: userInfo.image,
        description: paymentData.description,
        prefill: {
          name: userInfo.name,
          email: userInfo.email,
          contact: userInfo.contact,
        },
        handler: async (response) => {
          try {
            // Verify payment on backend
            const verifyResponse = await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              order_id: orderResponse.order_id,
            });

            if (verifyResponse.success) {
              resolve({
                success: true,
                transaction_id: verifyResponse.transaction_id,
                payment_id: verifyResponse.payment_id,
                amount: verifyResponse.amount,
              });
            } else {
              reject(new Error("Payment verification failed"));
            }
          } catch (error) {
            reject(error);
          }
        },
        modal: {
          ondismiss: () => {
            reject(new Error("Payment cancelled by user"));
          },
        },
        theme: {
          color: "#0284C7", // Tailwind blue-600
        },
      };

      openRazorpayCheckout(razorpayConfig).catch(reject);
    });
  } catch (error) {
    console.error("Payment processing error:", error);
    throw error;
  }
};

export default {
  initiatePayment,
  verifyPayment,
  requestRefund,
  getTransactionDetails,
  getInvoice,
  downloadInvoice,
  printInvoice,
  getBranchTransactionHistory,
  loadRazorpayScript,
  openRazorpayCheckout,
  processPayment,
};
