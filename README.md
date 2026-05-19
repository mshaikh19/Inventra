# INVENTRA — Adaptive AI-Powered Retail Intelligence Platform

Inventra is an adaptive, AI-powered retail intelligence platform. By automatically classifying business complexity, Inventra dynamically adjusts its interface to deliver tailored billing engines, real-time inventory tracking, and intelligent, holiday-aware ML demand forecasting.

## Core Features

- **Adaptive Dashboard**: Dynamically renders interfaces and analytics layouts based on business size (Small, Medium, Enterprise).
- **Smart Inventory & GST Billing**: Real-time multi-branch inventory logistics paired with automated GST (CGST/SGST/IGST) calculations.
- **AI Forecasting & Retraining**: Holiday-aware ML demand forecasting with a self-learning retraining pipeline based on continuous sales updates.
- **User Management & CSV Import**: JWT authentication, custom role guards, and Pandas-powered historical sales spreadsheet imports.

## Tech Stack

- **Backend**: FastAPI (Python), MongoDB
- **Frontend**: React (Vite), Tailwind CSS
- **AI/ML & Data**: Scikit-Learn, Pandas, NumPy

## Getting Started

### 1. Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt

```

### 2. Frontend (React)
```bash
cd frontend
npm install
npm run dev
```
