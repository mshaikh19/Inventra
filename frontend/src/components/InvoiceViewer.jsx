import React, { useState, useRef } from "react";
import PropTypes from "prop-types";
import { getInvoice, downloadInvoice, printInvoice } from "../utils/payments";
import { toast } from "react-toastify";

/**
 * InvoiceViewer Component
 * Display, print, and download invoices
 */
const InvoiceViewer = ({ transactionId, isOpen, onClose }) => {
  const [invoiceHtml, setInvoiceHtml] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const iframeRef = useRef(null);

  // Load invoice when modal opens
  React.useEffect(() => {
    if (isOpen && transactionId) {
      loadInvoice();
    }
  }, [isOpen, transactionId]);

  const loadInvoice = async () => {
    setIsLoading(true);
    setError("");
    try {
      const html = await getInvoice(transactionId);
      setInvoiceHtml(html);
    } catch (err) {
      const errorMessage = err.error || err.message || "Failed to load invoice";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = async () => {
    try {
      await printInvoice(transactionId);
      toast.success("Invoice sent to printer");
    } catch (err) {
      const errorMessage = err.error || err.message || "Failed to print invoice";
      toast.error(errorMessage);
    }
  };

  const handleDownload = async () => {
    try {
      await downloadInvoice(transactionId, `invoice-${transactionId}.html`);
      toast.success("Invoice downloaded successfully");
    } catch (err) {
      const errorMessage = err.error || err.message || "Failed to download invoice";
      toast.error(errorMessage);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold">Invoice Details</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-white hover:text-gray-200 disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="inline-block animate-spin">
                  <svg className="w-12 h-12 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
                <p className="mt-4 text-gray-600">Loading invoice...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="text-red-500 mb-4">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4v2m0-6a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                <p className="text-red-700 font-medium">{error}</p>
                <button
                  onClick={loadInvoice}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : invoiceHtml ? (
            <iframe
              ref={iframeRef}
              srcDoc={invoiceHtml}
              className="w-full h-full border-none"
              title="Invoice"
            />
          ) : null}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium"
          >
            Close
          </button>
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              disabled={isLoading || !invoiceHtml}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:opacity-50 font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z"
                />
              </svg>
              Print
            </button>
            <button
              onClick={handleDownload}
              disabled={isLoading || !invoiceHtml}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:opacity-50 font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

InvoiceViewer.propTypes = {
  transactionId: PropTypes.string.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default InvoiceViewer;
