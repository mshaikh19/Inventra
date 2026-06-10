import os
import asyncio
from dotenv import load_dotenv
from app.database.mongo import connectDatabase, databaseConnection

async def main():
    load_dotenv()
    print("--- MongoDB Diagnostic Utility ---")
    print(f"MONGODB_URL: {os.getenv('MONGODB_URL')}")
    print(f"DATABASE_NAME: {os.getenv('DATABASE_NAME')}")
    print("\nAttempting connection...")
    
    try:
        await connectDatabase()
        print("\n[SUCCESS] Connected to MongoDB successfully!")
        if databaseConnection.client:
            databaseConnection.client.close()
    except Exception as e:
        print(f"\n[FAILURE] Connection failed with error:")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
