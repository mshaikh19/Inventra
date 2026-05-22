export const DASHBOARD_TIERS = ["small", "medium", "large"];

const TIER_DISPLAY = {
  small: {
    name: "Starter",
    badge: "STARTER",
  },
  medium: {
    name: "Growth",
    badge: "GROWTH",
  },
  large: {
    name: "Enterprise",
    badge: "ENTERPRISE",
  },
};

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

export function getBillingPosTab(tier) {
  return `billing-pos-${normalizeBusinessTier(tier)}`;
}

export function getBillingPosPath(tier) {
  return `/billing-pos/${normalizeBusinessTier(tier)}`;
}

export function getBranchOpsTab(tier) {
  return `branch-ops-${normalizeBusinessTier(tier)}`;
}

export function getBranchOpsPath(tier) {
  return `/branch-ops/${normalizeBusinessTier(tier)}`;
}

export function getInventoryOpsTab(tier) {
  return `inventory-ops-${normalizeBusinessTier(tier)}`;
}

export function getInventoryOpsPath(tier) {
  return `/inventory-ops/${normalizeBusinessTier(tier)}`;
}

export function getDashboardTierFromPath(pathname) {
  const path = String(pathname || "").toLowerCase();
  if (path.startsWith("/dashboard/large")) return "large";
  if (path.startsWith("/dashboard/medium")) return "medium";
  if (path.startsWith("/dashboard/small")) return "small";
  return null;
}

export function getBillingPosTierFromPath(pathname) {
  const path = String(pathname || "").toLowerCase();
  if (path.startsWith("/billing-pos/large")) return "large";
  if (path.startsWith("/billing-pos/medium")) return "medium";
  if (path.startsWith("/billing-pos/small")) return "small";
  return null;
}

export function getBranchOpsTierFromPath(pathname) {
  const path = String(pathname || "").toLowerCase();
  if (path.startsWith("/branch-ops/large")) return "large";
  if (path.startsWith("/branch-ops/medium")) return "medium";
  if (path.startsWith("/branch-ops/small")) return "small";
  return null;
}

export function getInventoryOpsTierFromPath(pathname) {
  const path = String(pathname || "").toLowerCase();
  if (path.startsWith("/inventory-ops/large")) return "large";
  if (path.startsWith("/inventory-ops/medium")) return "medium";
  if (path.startsWith("/inventory-ops/small")) return "small";
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

export function getBillingPosTabFromUser(user) {
  return getBillingPosTab(getDashboardTierFromUser(user));
}

export function getTierDisplayName(value) {
  const normalized = normalizeBusinessTier(value);
  return TIER_DISPLAY[normalized].name;
}

export function getTierBadgeLabel(value) {
  const normalized = normalizeBusinessTier(value);
  return TIER_DISPLAY[normalized].badge;
}

export function getUserDisplayName(user, fallback = "Manager") {
  if (!user || typeof user !== "object") return fallback;

  const first = String(user.firstName || "").trim();
  const last = String(user.lastName || "").trim();
  const full = `${first} ${last}`.trim();
  if (full) return full;

  const named = String(user.fullName || user.name || "").trim();
  if (named) return named;

  const email = String(user.email || "").trim();
  if (email) return email;

  return fallback;
}
