import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME")

class Database:
    client: AsyncIOMotorClient = None
    db = None

databaseConnection = Database()

async def connectDatabase():
    """Connect to MongoDB with connection pooling and timeouts."""
    print("[DEBUG] Starting MongoDB connection...")
    try:
        # AsyncIOMotorClient with connection timeout
        databaseConnection.client = AsyncIOMotorClient(
            MONGODB_URL,
            serverSelectionTimeoutMS=5000,  # 5 second timeout for server selection
            socketTimeoutMS=5000,  # 5 second socket timeout
            connectTimeoutMS=5000  # 5 second connection timeout
        )
        # Test the connection
        await databaseConnection.client.admin.command('ping')
        print(f"[DEBUG] Ping successful")
        
        databaseConnection.db = databaseConnection.client[DATABASE_NAME]
        print(f"[DEBUG] Connected to MongoDB at {MONGODB_URL}, using database: {DATABASE_NAME}")
    except Exception as e:
        print(f"[DEBUG] MongoDB connection error: {e}")
        raise

async def closeConnection():
    if databaseConnection.client:
        databaseConnection.client.close()
        print("MongoDB connection closed.")

def getDatabase():
    return databaseConnection.db
