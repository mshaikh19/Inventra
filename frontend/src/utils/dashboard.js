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

export function getBusinessSlug() {
  if (typeof window === "undefined") return "my-business";
  try {
    const rawUser = localStorage.getItem("inventra_user") || sessionStorage.getItem("inventra_user");
    if (rawUser) {
      const user = JSON.parse(rawUser);
      const name = user.businessName || user.company || "my-business";
      return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }
  } catch (e) {
    // ignore
  }
  return "my-business";
}

export function getDashboardPath(tier) {
  return `/dashboard/${getBusinessSlug()}`;
}

export function getBillingPosTab(tier) {
  return `billing-pos-${normalizeBusinessTier(tier)}`;
}

export function getBillingPosPath(tier) {
  return `/billing-pos/${getBusinessSlug()}`;
}

export function getBranchOpsTab(tier) {
  return `branch-ops-${normalizeBusinessTier(tier)}`;
}

export function getBranchOpsPath(tier) {
  return `/branch-ops/${getBusinessSlug()}`;
}

export function getInventoryOpsTab(tier) {
  return `inventory-ops-${normalizeBusinessTier(tier)}`;
}

export function getInventoryOpsPath(tier) {
  return `/inventory-ops/${getBusinessSlug()}`;
}

export function getDashboardTierFromPath(pathname) {
  const path = String(pathname || "").toLowerCase();
  if (path.startsWith("/dashboard/")) {
    if (typeof window !== "undefined") {
      try {
        const rawUser = localStorage.getItem("inventra_user") || sessionStorage.getItem("inventra_user");
        if (rawUser) return getDashboardTierFromUser(JSON.parse(rawUser));
      } catch (e) {}
    }
    if (path.includes("large")) return "large";
    if (path.includes("medium")) return "medium";
    return "small";
  }
  return null;
}

export function getBillingPosTierFromPath(pathname) {
  const path = String(pathname || "").toLowerCase();
  if (path.startsWith("/billing-pos/")) {
    if (typeof window !== "undefined") {
      try {
        const rawUser = localStorage.getItem("inventra_user") || sessionStorage.getItem("inventra_user");
        if (rawUser) return getDashboardTierFromUser(JSON.parse(rawUser));
      } catch (e) {}
    }
    if (path.includes("large")) return "large";
    if (path.includes("medium")) return "medium";
    return "small";
  }
  return null;
}

export function getBranchOpsTierFromPath(pathname) {
  const path = String(pathname || "").toLowerCase();
  if (path.startsWith("/branch-ops/")) {
    if (typeof window !== "undefined") {
      try {
        const rawUser = localStorage.getItem("inventra_user") || sessionStorage.getItem("inventra_user");
        if (rawUser) return getDashboardTierFromUser(JSON.parse(rawUser));
      } catch (e) {}
    }
    if (path.includes("large")) return "large";
    if (path.includes("medium")) return "medium";
    return "small";
  }
  return null;
}

export function getInventoryOpsTierFromPath(pathname) {
  const path = String(pathname || "").toLowerCase();
  if (path.startsWith("/inventory-ops/")) {
    if (typeof window !== "undefined") {
      try {
        const rawUser = localStorage.getItem("inventra_user") || sessionStorage.getItem("inventra_user");
        if (rawUser) return getDashboardTierFromUser(JSON.parse(rawUser));
      } catch (e) {}
    }
    if (path.includes("large")) return "large";
    if (path.includes("medium")) return "medium";
    return "small";
  }
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
