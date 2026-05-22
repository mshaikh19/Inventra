import { normalizeBusinessTier } from "./dashboard";

export const DEFAULT_BRANCHES_BY_TIER = {
  small: ["Main Store"],
  medium: ["Mumbai Hub", "Delhi Branch", "Bangalore Branch", "Pune Depot"],
  large: ["Mumbai Hub", "Delhi Branch", "Bangalore Branch", "Pune Depot", "New York Hub", "London Branch", "Tokyo Depot", "Singapore Hub"],
};

const STORAGE_KEY = "inventra_branch_network";

export function getBranchNetwork(tier = "small") {
  const normalizedTier = normalizeBusinessTier(tier);
  const defaults = DEFAULT_BRANCHES_BY_TIER[normalizedTier] || DEFAULT_BRANCHES_BY_TIER.small;

  if (typeof window === "undefined") return defaults;

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const customBranches = Array.isArray(stored) ? stored.filter(Boolean) : [];
    return [...new Set([...defaults, ...customBranches])];
  } catch {
    return defaults;
  }
}

export function addBranchToNetwork(branchName) {
  const normalizedName = String(branchName || "").trim();
  if (!normalizedName || typeof window === "undefined") return getBranchNetwork("large");

  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  const next = [...new Set([...(Array.isArray(stored) ? stored : []), normalizedName])];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
