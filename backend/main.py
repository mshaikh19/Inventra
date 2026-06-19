import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.database.mongo import connectDatabase, closeConnection
from app.routes import auth
from app.routes import classify
from app.routes import dashboard
from app.routes import branches
from app.routes import payment
from app.routes import notifications
from app.routes import employees
from app.routes import tasks
from app.services.ml_classifier import classifier

# Load environment variables
load_dotenv()

PROJECT = os.getenv("PROJECT_NAME")

@asynccontextmanager
async def appLifespan(app: FastAPI):
    # Startup connection
    await connectDatabase()
    
    # Initialize ML classifier asynchronously (don't block startup)
    import asyncio
    async def init_classifier():
        try:
            # Run classifier.initialize() in a thread to prevent blocking
            loop = asyncio.get_event_loop()
            loop.run_in_executor(None, classifier.initialize)
        except Exception as e:
            print(f"[WARNING] ML classifier initialization failed: {e}")
    
    # Schedule classifier init but don't wait for it
    asyncio.create_task(init_classifier())
    
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
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    origins.append(frontend_url)
    origins.append(frontend_url.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex="https://.*\\.vercel\\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include sub-routers under api v1 namespace
app.include_router(auth.router,      prefix="/api/v1/auth",      tags=["Authentication"])
app.include_router(classify.router,   prefix="/api/v1",           tags=["Classifier"])
app.include_router(dashboard.router,  prefix="/api/v1/dashboard", tags=["Dashboards"])
app.include_router(branches.router,   prefix="/api/v1/branches",  tags=["Branches"])
app.include_router(payment.router,    prefix="/api/v1",           tags=["Payments"])
app.include_router(notifications.router, prefix="/api/v1",       tags=["Notifications"])
app.include_router(employees.router,   prefix="/api/v1/employees",  tags=["Employees"])
app.include_router(tasks.router,       prefix="/api/v1/tasks",      tags=["Tasks"])

@app.get("/")
async def getRoot():
    return {
        "status": "online",
        "app_name": PROJECT,
        "docs_url": "/docs"
    }
