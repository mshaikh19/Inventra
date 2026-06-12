import {
  getBillingPosTab,
  getInventoryOpsTab,
  normalizeBusinessTier,
  userHasOwnerAccess,
} from "./dashboard";

/** Branch-type → employee role slug (matches backend employees.py) */
export function getEmployeeRoleForBranchType(branchType) {
  const t = String(branchType || "Store").toLowerCase();
  if (t === "warehouse") return "warehouse_employee";
  if (t === "franchise") return "franchise_employee";
  if (t === "depot") return "depot_employee";
  return "store_employee";
}

/** Whether the user is a branch employee (not owner/manager). */
export function isEmployeeUser(user) {
  if (!user || userHasOwnerAccess(user)) return false;
  const role = String(user.role || "").trim().toLowerCase();
  const roles = Array.isArray(user.roles)
    ? user.roles.map((r) => String(r || "").trim().toLowerCase())
    : [];
  if (role === "manager" || role.endsWith("_manager") || roles.includes("manager")) return false;
  return (
    role === "employee" ||
    role.endsWith("_employee") ||
    roles.includes("employee") ||
    roles.some((r) => r.endsWith("_employee"))
  );
}

/** Whether the user is a branch manager. */
export function isManagerUser(user) {
  if (!user || userHasOwnerAccess(user)) return false;
  const role = String(user.role || "").trim().toLowerCase();
  const roles = Array.isArray(user.roles)
    ? user.roles.map((r) => String(r || "").trim().toLowerCase())
    : [];
  return role === "manager" || role.endsWith("_manager") || roles.includes("manager");
}

/** Resolve operational environment from role + branch type. */
export function getEmployeeEnvironment(user, branch) {
  const role = String(user?.role || "").trim().toLowerCase();
  const branchType = String(branch?.branch_type || "Store").toLowerCase();

  const isWarehouseLike =
    role.startsWith("warehouse_") ||
    role.startsWith("depot_") ||
    ["warehouse", "depot", "factory"].includes(branchType);

  if (isWarehouseLike) {
    return {
      key: branchType === "depot" ? "depot" : "warehouse",
      primaryTab: "inventory",
      label: branchType === "depot" ? "Depot Operations" : "Warehouse Operations",
      icon: branchType === "depot" ? "📦" : "🏭",
      blurb:
        branchType === "depot"
          ? "Manage stock intake, aisle routing, and depot dispatch duties."
          : "Handle stock adjustments, aisle management, and warehouse intake.",
    };
  }

  const isFranchise = role.startsWith("franchise_") || branchType === "franchise";
  return {
    key: isFranchise ? "franchise" : "store",
    primaryTab: "billing",
    label: isFranchise ? "Franchise POS" : "Store Checkout",
    icon: isFranchise ? "🤝" : "🏪",
    blurb: isFranchise
      ? "Process franchise sales, returns, and customer billing at your outlet."
      : "Run point-of-sale checkout, process sales, and handle customer billing.",
  };
}

/** Quick-action buttons shown on the employee task board. */
export function getEmployeeQuickActions(environment, tier, setActiveTab) {
  const normalizedTier = normalizeBusinessTier(tier);
  const actions = [];

  if (environment.primaryTab === "billing") {
    actions.push({
      key: "pos",
      label: "Open Billing POS",
      description: "Process sales & generate GST invoices",
      icon: "🧾",
      accent: "#0284C7",
      onClick: () => setActiveTab(getBillingPosTab(normalizedTier)),
    });
  } else {
    actions.push({
      key: "inventory",
      label: "Open Inventory Desk",
      description: "Stock adjustments, aisle intake & barcode scan",
      icon: "📦",
      accent: "#059669",
      onClick: () => setActiveTab(getInventoryOpsTab(normalizedTier)),
    });
  }

  return actions;
}

/** Suggested task templates managers can pick when assigning duties. */
export function getTaskTemplatesForBranch(branchType) {
  const t = String(branchType || "Store").toLowerCase();
  const common = [
    { title: "Opening shift checklist", description: "Verify registers, clean counters, and confirm stock displays.", priority: "medium" },
    { title: "Closing shift checklist", description: "Reconcile cash drawer, secure premises, and log end-of-day notes.", priority: "medium" },
  ];

  if (t === "warehouse" || t === "factory") {
    return [
      { title: "Restock picking aisles", description: "Replenish fast-moving SKUs and flag low-stock bins.", priority: "high" },
      { title: "Receive inbound shipment", description: "Scan incoming pallets, verify PO quantities, and update aisle locations.", priority: "high" },
      { title: "Cycle count zone B", description: "Perform spot counts and reconcile discrepancies with floor manager.", priority: "medium" },
      ...common,
    ];
  }

  if (t === "depot") {
    return [
      { title: "Sort depot dispatch queue", description: "Stage outbound cartons by route and verify dispatch labels.", priority: "high" },
      { title: "Unload inbound truck", description: "Scan incoming cartons and route to correct depot aisles.", priority: "high" },
      { title: "Update aisle location tags", description: "Re-label relocated stock and sync barcode mappings.", priority: "medium" },
      ...common,
    ];
  }

  if (t === "franchise") {
    return [
      { title: "Restock franchise display", description: "Refresh promotional shelves and verify franchise pricing tags.", priority: "medium" },
      { title: "Process franchise returns", description: "Handle customer returns per franchise policy and update POS.", priority: "medium" },
      { title: "Daily sales reconciliation", description: "Match POS totals with cash/card settlements before handoff.", priority: "high" },
      ...common,
    ];
  }

  // Store (default)
  return [
    { title: "Restock front shelves", description: "Refill fast-moving items on the shop floor and face products.", priority: "medium" },
    { title: "Expiry date audit", description: "Check dairy, bakery, and chilled sections for near-expiry items.", priority: "high" },
    { title: "Assist POS queue", description: "Support checkout during peak hours and bag customer orders.", priority: "medium" },
    ...common,
  ];
}

/** Role options for task assignment dropdown, scoped to branch type. */
export function getTaskRoleOptions(branchType, { includeManagers = true } = {}) {
  const role = getEmployeeRoleForBranchType(branchType);
  const options = [
    { value: role, label: role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) },
    { value: "employee", label: "All Employees (General)" },
  ];
  if (includeManagers) {
    const t = String(branchType || "Store").toLowerCase();
    let managerRole = "store_manager";
    if (t === "warehouse") managerRole = "warehouse_manager";
    else if (t === "franchise") managerRole = "franchise_manager";
    else if (t === "depot") managerRole = "depot_manager";
    options.push({ value: managerRole, label: managerRole.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) });
    options.push({ value: "manager", label: "Branch Managers (General)" });
  }
  return options;
}

/** Employee-facing access scope label for profile cards. */
export function getEmployeeAccessLabel(environment, tier) {
  const tierName = normalizeBusinessTier(tier) === "large" ? "Enterprise" : normalizeBusinessTier(tier) === "medium" ? "Growth" : "Starter";
  if (environment.key === "warehouse" || environment.key === "depot") {
    return `${tierName} · Branch-scoped inventory desk`;
  }
  return `${tierName} · Branch-scoped POS checkout`;
}
