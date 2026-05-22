from copy import deepcopy


def normalize_business_tier(value):
    raw_value = str(value or "").strip().lower()
    if raw_value in {"large", "enterprise", "enterprise-intelligence", "dashboard-large"}:
        return "large"
    if raw_value in {"medium", "mid", "mid-market", "dashboard-medium"}:
        return "medium"
    return "small"


_DASHBOARD_PROFILES = {
    "small": {
        "tier": "small",
        "title": "Small Business Dashboard",
        "badge": "Starter Intelligence",
        "accent": "#0EA5E9",
        "accentSoft": "rgba(14, 165, 233, 0.14)",
        "background": "linear-gradient(135deg, #081120 0%, #0F172A 45%, #10263F 100%)",
        "subtitle": "Starter-friendly inventory intelligence for a single store or a lean team.",
        "summary": "Fast setup, low-friction reporting, and practical alerts that keep daily operations moving.",
        "metrics": [
            {"label": "Forecast focus", "value": "Demand + festival spikes"},
            {"label": "Primary wins", "value": "Alerts + billing"},
            {"label": "Interface", "value": "Beginner-friendly"},
        ],
        "sections": [
            {
                "title": "Starter Intelligence Features",
                "items": [
                    "Basic demand forecasting",
                    "Festival demand alerts",
                    "Smart stock suggestions",
                ],
            },
            {
                "title": "Stock Control",
                "items": [
                    "Inventory tracking",
                    "Low-stock alerts",
                    "Expiry notifications",
                    "Fast-moving product tracking",
                ],
            },
            {
                "title": "Daily Operations",
                "items": [
                    "Billing & invoice generation",
                    "Daily sales summary",
                    "Simple analytics dashboard",
                    "CSV upload support",
                    "Beginner-friendly interface",
                ],
            },
        ],
    },
    "medium": {
        "tier": "medium",
        "title": "Medium Business Dashboard",
        "badge": "Smart Operations",
        "accent": "#F59E0B",
        "accentSoft": "rgba(245, 158, 11, 0.16)",
        "background": "linear-gradient(135deg, #120F08 0%, #1E1505 42%, #312106 100%)",
        "subtitle": "Operational intelligence for growing businesses that need tighter control and sharper planning.",
        "summary": "Balanced forecasting, supplier visibility, and performance reporting for multi-step workflows.",
        "metrics": [
            {"label": "Forecast focus", "value": "Seasonal + reorder planning"},
            {"label": "Primary wins", "value": "Profit + supplier insights"},
            {"label": "Interface", "value": "Action-oriented"},
        ],
        "sections": [
            {
                "title": "Forecasting & Trend Planning",
                "items": [
                    "Advanced demand forecasting",
                    "Seasonal trend prediction",
                    "Trend analysis dashboard",
                ],
            },
            {
                "title": "Supply Chain Intelligence",
                "items": [
                    "Supplier analytics",
                    "Smart reorder recommendations",
                    "Automated stock alerts",
                    "Smart procurement suggestions",
                    "Inventory optimization insights",
                ],
            },
            {
                "title": "Business Performance",
                "items": [
                    "Profit & revenue analytics",
                    "Inventory health monitoring",
                    "Product performance analytics",
                    "Category-wise sales analysis",
                    "Employee activity tracking",
                    "Advanced reporting system",
                ],
            },
        ],
    },
    "large": {
        "tier": "large",
        "title": "Large Business Dashboard",
        "badge": "Enterprise Intelligence",
        "accent": "#10B981",
        "accentSoft": "rgba(16, 185, 129, 0.16)",
        "background": "linear-gradient(135deg, #06110B 0%, #0C1A13 45%, #0D2A1E 100%)",
        "subtitle": "Enterprise-grade oversight for distributed operations, warehouses, and regional demand planning.",
        "summary": "Multi-branch coordination, real-time monitoring, and predictive inventory control at scale.",
        "metrics": [
            {"label": "Forecast focus", "value": "Enterprise engine + branches"},
            {"label": "Primary wins", "value": "Allocation + executive reporting"},
            {"label": "Interface", "value": "Control-room ready"},
        ],
        "sections": [
            {
                "title": "Enterprise Control",
                "items": [
                    "Multi-branch inventory management",
                    "Centralized inventory control",
                    "Real-time branch monitoring",
                    "Branch-wise performance analytics",
                    "Warehouse inventory management",
                    "Automated inventory allocation",
                ],
            },
            {
                "title": "Predictive Engine",
                "items": [
                    "Enterprise forecasting engine",
                    "Regional demand analysis",
                    "Predictive inventory optimization",
                    "Advanced profit forecasting",
                ],
            },
            {
                "title": "Leadership & Alerts",
                "items": [
                    "Procurement planning system",
                    "Executive analytics dashboard",
                    "Enterprise reporting system",
                    "AI-powered business insights",
                    "Enterprise alert management",
                ],
            },
        ],
    },
}

_COMMON_FEATURES = [
    "User authentication",
    "AI-generated alerts",
    "Inventory management",
    "Billing system",
    "Forecast summaries",
    "Product management",
    "Sales tracking",
    "CSV upload system",
    "Persistent AI learning",
    "Responsive mobile-friendly UI",
]


def get_dashboard_profile(value):
    tier = normalize_business_tier(value)
    profile = deepcopy(_DASHBOARD_PROFILES[tier])
    profile["routePath"] = f"/dashboard/{tier}"
    profile["commonFeatures"] = list(_COMMON_FEATURES)
    profile["featureCount"] = sum(len(section["items"]) for section in profile["sections"]) + len(_COMMON_FEATURES)
    return profile