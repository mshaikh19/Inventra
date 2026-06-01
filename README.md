# Inventra

Inventra is a full‑stack, AI-driven retail intelligence prototype. It provides adaptive dashboards, multi-branch inventory management, a POS billing flow with invoice generation, inventory-driven notifications, and a compact ML service that classifies businesses into `small`, `medium`, or `large` tiers.

Core capabilities
- Adaptive dashboard profiles per business tier
- Branch and inventory management with per-branch inventories
- POS checkout, invoice generation, and refunds
- Inventory-driven notifications (low-stock, expiry)
- Business-tier ML classifier with seed data and retraining support

Tech stack
- Backend: FastAPI
- Frontend: React + Vite, Tailwind CSS
- ML: scikit-learn, pandas, numpy


Prerequisites
- Python 3.10+ and a virtual environment
- Node.js + npm (for frontend)
- MongoDB (local or Atlas)

Quick start (development)

1) Backend

```bash
cd backend
pip install -r requirements.txt
python uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

2) Frontend

```bash
cd frontend
npm install
npm run dev
```


