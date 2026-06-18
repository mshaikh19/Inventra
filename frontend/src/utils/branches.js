const API_BASE = "http://127.0.0.1:8000/api/v1/branches";

export function getAuthHeaders() {
  const token =
    localStorage.getItem("inventra_token") ||
    sessionStorage.getItem("inventra_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function getCurrentUserId(user) {
  if (user) return user.id || user._id || user.email || "default";

  if (typeof window === "undefined") return "default";

  const rawUser =
    localStorage.getItem("inventra_user") ||
    sessionStorage.getItem("inventra_user");
  if (!rawUser) return "default";

  try {
    const parsedUser = JSON.parse(rawUser);
    return parsedUser.id || parsedUser._id || parsedUser.email || "default";
  } catch {
    return "default";
  }
}

export function markBranchSetupCompleted(user) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    `inventra_onboarding_completed_${getCurrentUserId(user)}`,
    "true",
  );
}

export function isBranchSetupComplete(branchData) {
  const branches = Array.isArray(branchData?.branches)
    ? branchData.branches
    : [];
  const expectedBranches =
    typeof branchData?.expected_branches === "number"
      ? branchData.expected_branches
      : 1;

  return branches.length >= expectedBranches && branches.length > 0;
}

/** Create a new branch for the authenticated business */
export async function createBranch(branchData) {
  const res = await fetch(API_BASE + "/", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(branchData),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data.detail && typeof data.detail === "object"
        ? data.detail.message
        : data.detail) || "Failed to create branch";
    throw new Error(msg);
  }

  // Automatically add the new branch name to localStorage cache
  if (data.branch_name && typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("inventra_branches");
      let names = [];
      if (stored) {
        names = JSON.parse(stored);
      }
      if (!names.includes(data.branch_name)) {
        names.push(data.branch_name);
        localStorage.setItem("inventra_branches", JSON.stringify(names));
      }
    } catch (e) {
      console.warn("Failed to update branches cache:", e);
    }
  }

  return data;
}

/** Fetch all branches for the authenticated business */
export async function getUserBranches() {
  const res = await fetch(API_BASE + "/", {
    method: "GET",
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Failed to fetch branches");
  }

  // Automatically sync to localStorage
  if (
    data.branches &&
    Array.isArray(data.branches) &&
    typeof window !== "undefined"
  ) {
    const names = data.branches.map((b) => b.branch_name);
    localStorage.setItem("inventra_branches", JSON.stringify(names));
  }

  return data; // { branches: [...], total: N }
}

/** Fetch a single branch by its branch_id (e.g. "BR001") or MongoDB _id */
export async function getBranchById(branchId) {
  const res = await fetch(`${API_BASE}/${branchId}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Branch not found");
  }
  return data;
}

/** Fetch inventory for a branch from the backend database */
export async function getBranchInventory(branchId) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(branchId)}/inventory`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Failed to fetch branch inventory");
  }
  return data;
}

/** Add a new inventory item for a branch */
export async function createBranchInventoryItem(branchId, itemData) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(branchId)}/inventory/items`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(itemData),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data.detail && typeof data.detail === "string"
        ? data.detail
        : data.detail?.message) || "Failed to add inventory item",
    );
  }
  return data;
}

/** Update an inventory item for a branch */
export async function updateBranchInventoryItem(branchId, itemId, itemData) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(branchId)}/inventory/items/${itemId}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(itemData),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data.detail && typeof data.detail === "string"
        ? data.detail
        : data.detail?.message) || "Failed to update inventory item",
    );
  }
  return data;
}

/** Delete an inventory item from a branch */
export async function deleteBranchInventoryItem(branchId, itemId) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(branchId)}/inventory/items/${itemId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data.detail && typeof data.detail === "string"
        ? data.detail
        : data.detail?.message) || "Failed to delete inventory item",
    );
  }
  return data;
}

/** Update a branch (partial update) */
export async function updateBranch(branchId, updates) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(branchId)}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Failed to update branch");
  }
  return data;
}

/** Deactivate (soft-delete) a branch */
export async function deactivateBranch(branchId) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(branchId)}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Failed to deactivate branch");
  }
  return data;
}

/** Check if the current user has at least one branch set up */
export async function hasSetupBranches() {
  try {
    const result = await getUserBranches();
    return result.total > 0;
  } catch {
    return false;
  }
}

/** Synchronously get branch network from localStorage */
export function getBranchNetwork(_tier) {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem("inventra_branches");
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // ignore
    }
  }
  return [];
}

/** Synchronously add branch to network (cached in localStorage) */
export function addBranchToNetwork(branch) {
  if (typeof window === "undefined") return;
  const name =
    typeof branch === "string" ? branch : branch.name || branch.branch_name;
  if (!name) return;
  const current = getBranchNetwork("large");
  if (!current.includes(name)) {
    const updated = [...current, name];
    localStorage.setItem("inventra_branches", JSON.stringify(updated));
  }
}

/**
 * Record a completed POS sale to the database.
 * Deducts quantities from live branch inventory and writes a sales document.
 *
 * @param {string} branchId - Branch ID or name
 * @param {Object} saleData - { items, invoice_number, payment_mode, amount_paid, grand_total, change_due, customer_name, customer_state, cashier }
 */
export async function recordBranchSale(branchId, saleData) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(branchId)}/sales`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(saleData),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data.detail && typeof data.detail === "string"
        ? data.detail
        : data.detail?.message) || "Failed to record sale";
    throw new Error(msg);
  }
  return data; // { message, invoice_number, updated_items, ... }
}

