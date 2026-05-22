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
    // stored items may be strings (legacy) or objects { name, properName, address }
    const customNames = customBranches.map((b) => (typeof b === "string" ? b : b.name)).filter(Boolean);
    return [...new Set([...defaults, ...customNames])];
  } catch {
    return defaults;
  }
}

export function addBranchToNetwork(branch) {
  if (typeof window === "undefined") return getBranchNetwork("large");

  // Accept either a string name or an object with details
  const branchObj = typeof branch === "string" ? { name: String(branch || "").trim() } : (branch || {});
  const name = String(branchObj.name || "").trim();
  if (!name) return getBranchNetwork("large");

  const storedRaw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  const stored = Array.isArray(storedRaw) ? storedRaw : [];

  // Prevent duplicates by name
  const exists = stored.some((b) => {
    if (typeof b === "string") return b === name;
    return String(b.name || "").trim() === name;
  });

  if (!exists) {
    // store as an object to preserve details
    stored.push({ name, properName: branchObj.properName || "", address: branchObj.address || "" });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }

  // Return the updated network (as display names)
  return getBranchNetwork("large");
}
