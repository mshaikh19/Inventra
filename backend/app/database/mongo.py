import os
import re
import socket
import dns.resolver
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME")

def _resolve_srv_uri(uri):
    if not uri.startswith("mongodb+srv://"):
        return uri
    match = re.match(r"mongodb\+srv://([^@]+@)?([^/?]+)(.*)", uri)
    if not match:
        return uri
    userinfo = match.group(1) or ""
    hostname = match.group(2)
    rest = match.group(3) or ""
    resolver = dns.resolver.Resolver()
    resolver.nameservers = ["1.1.1.1", "1.0.0.1"]
    resolver.port = 53
    try:
        answers = resolver.resolve(f"_mongodb._tcp.{hostname}", "SRV")
        hosts = []
        for rdata in answers:
            target_host = str(rdata.target).rstrip('.')
            hosts.append(f"{target_host}:{rdata.port}")
        if not hosts:
            return uri
        # parse query params from rest
        params = {}
        if "?" in rest:
            qs = rest[rest.index("?") + 1:]
            for part in qs.split("&"):
                if "=" in part:
                    k, v = part.split("=", 1)
                    params[k] = v
        params.setdefault("ssl", "true")
        params.setdefault("authSource", "admin")
        qs = "&".join(f"{k}={v}" for k, v in params.items())
        base_path = rest.split("?")[0] if "?" in rest else rest
        return f"mongodb://{userinfo}{','.join(hosts)}{base_path}?{qs}"
    except Exception as e:
        print(f"[WARN] DNS SRV resolution failed, falling back to original URI: {e}")
        return uri


class Database:
    client: AsyncIOMotorClient = None
    db = None

databaseConnection = Database()

async def connectDatabase():
    """Connect to MongoDB with connection pooling and timeouts."""
    print("[DEBUG] Starting MongoDB connection...")
    try:
        resolved_uri = _resolve_srv_uri(MONGODB_URL)
        if resolved_uri != MONGODB_URL:
            print(f"[DEBUG] Resolved SRV URI to non-SRV format")
        databaseConnection.client = AsyncIOMotorClient(
            resolved_uri,
            serverSelectionTimeoutMS=5000,
            socketTimeoutMS=5000,
            connectTimeoutMS=5000
        )
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
