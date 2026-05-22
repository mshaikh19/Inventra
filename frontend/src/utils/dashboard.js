export const DASHBOARD_TIERS = ["small", "medium", "large"];

export function normalizeBusinessTier(value) {
  if (!value) return "small";

  const tier = String(value).trim().toLowerCase();
  if (tier === "enterprise") return "large";
  if (DASHBOARD_TIERS.includes(tier)) return tier;
  return "small";
}

export function getDashboardTab(tier) {
  return `dashboard-${normalizeBusinessTier(tier)}`;
}

export function getDashboardPath(tier) {
  return `/dashboard/${normalizeBusinessTier(tier)}`;
}

export function getDashboardTierFromPath(pathname) {
  const path = String(pathname || "").toLowerCase();
  if (path.startsWith("/dashboard/large")) return "large";
  if (path.startsWith("/dashboard/medium")) return "medium";
  if (path.startsWith("/dashboard/small")) return "small";
  return null;
}

export function getDashboardTierFromUser(user) {
  if (!user) return "small";

  return normalizeBusinessTier(
    user.businessTier ||
      user.classification ||
      user.tier ||
      user.dashboardTier ||
      user.dashboardPath ||
      user.businessSize,
  );
}

export function getDashboardTabFromUser(user) {
  return getDashboardTab(getDashboardTierFromUser(user));
}
