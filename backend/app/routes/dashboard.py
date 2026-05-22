from fastapi import APIRouter

from app.services.dashboard_profiles import get_dashboard_profile, normalize_business_tier

router = APIRouter()


@router.get("")
async def get_default_dashboard():
    return get_dashboard_profile("small")


@router.get("/{tier}")
async def get_dashboard(tier: str):
    return get_dashboard_profile(normalize_business_tier(tier))