import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.database.mongo import connectDatabase, closeConnection
from app.routes import auth
from app.routes import classify
from app.routes import dashboard
from app.services.ml_classifier import classifier

# Load environment variables
load_dotenv()

PROJECT = os.getenv("PROJECT_NAME")

@asynccontextmanager
async def appLifespan(app: FastAPI):
    # Startup connection
    await connectDatabase()
    # Initialize ML classifier (loads model or trains seed data)
    try:
        classifier.initialize()
    except Exception:
        # Don't block app startup for ML initialization failures
        pass
    yield
    # Shutdown connection
    await closeConnection()

app = FastAPI(
    title=PROJECT,
    description="Adaptive AI-Powered Retail Intelligence Platform API service",
    version="1.0.0",
    lifespan=appLifespan
)

# CORS configuration to bridge backend and frontend
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include sub-routers under api v1 namespace
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
# classifier endpoints (schema, classify, status, retrain)
# the router already defines /classify and /schema, so mount it at /api/v1
app.include_router(classify.router, prefix="/api/v1", tags=["Classifier"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboards"])
# app.include_router(inventory.router, prefix="/api/v1/inventory", tags=["Inventory & Billing"])
# app.include_router(forecast.router, prefix="/api/v1/forecast", tags=["AI Forecasting"])

@app.get("/")
async def getRoot():
    return {
        "status": "online",
        "app_name": PROJECT,
        "docs_url": "/docs"
    }
