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
    databaseConnection.client = AsyncIOMotorClient(MONGODB_URL)
    databaseConnection.db = databaseConnection.client[DATABASE_NAME]
    print(f"Connected to MongoDB at {MONGODB_URL}, using database: {DATABASE_NAME}")

async def closeConnection():
    if databaseConnection.client:
        databaseConnection.client.close()
        print("MongoDB connection closed.")

def getDatabase():
    return databaseConnection.db
