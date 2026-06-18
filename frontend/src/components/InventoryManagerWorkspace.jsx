import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { getBranchInventory } from "../utils/branches";
import InventoryTable from "./InventoryTable";

export default function InventoryManagerWorkspace({
  user,
  branch,
  setActiveTab,
}) {
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInventory();
  }, [branch?.branch_id]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      if (!branch?.branch_id) {
        toast.error("No branch assigned");
        return;
      }
      const data = await getBranchInventory(branch.branch_id);
      setInventory(data);
    } catch (err) {
      toast.error(err.message || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  const branchType = String(branch?.branch_type || "Store").toLowerCase();
  const typeLabel =
    {
      warehouse: "Warehouse",
      depot: "Depot",
      franchise: "Franchise",
    }[branchType] || "Store";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">📋</span>
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  {typeLabel} Inventory Manager
                </h2>
                <p className="text-sm font-semibold text-slate-600 mt-1">
                  Full inventory control dashboard for{" "}
                  {branch?.branch_name || typeLabel}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={loadInventory}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            <svg
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-3 mt-6">
          <div className="rounded-xl bg-white/60 border border-blue-100 p-3">
            <span className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
              Total Items
            </span>
            <span className="block text-2xl font-black text-blue-600 mt-1">
              {inventory?.total_items || 0}
            </span>
          </div>
          <div className="rounded-xl bg-white/60 border border-cyan-100 p-3">
            <span className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
              Total Units
            </span>
            <span className="block text-2xl font-black text-cyan-600 mt-1">
              {inventory?.inventory?.total_units || 0}
            </span>
          </div>
          <div className="rounded-xl bg-white/60 border border-teal-100 p-3">
            <span className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
              Branch
            </span>
            <span className="block text-lg font-black text-teal-600 mt-1 truncate">
              {branch?.branch_code}
            </span>
          </div>
          <div className="rounded-xl bg-white/60 border border-blue-200 p-3">
            <span className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
              Type
            </span>
            <span className="block text-lg font-black text-blue-700 mt-1">
              {typeLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="h-12 w-12 mx-auto mb-4 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" />
              <span className="text-sm font-bold text-slate-500">
                Loading inventory...
              </span>
            </div>
          </div>
        ) : inventory?.items && inventory.items.length > 0 ? (
          <InventoryTable
            items={inventory.items}
            branchId={branch?.branch_id}
            onRefresh={loadInventory}
            isInventoryManager={true}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-lg font-black text-slate-800 mb-2">
              No Inventory Items
            </h3>
            <p className="text-sm text-slate-600 text-center max-w-sm mb-6">
              Start by adding items to track stock levels, expiry dates, and SKU
              details.
            </p>
            <button
              onClick={() => setActiveTab("inventory")}
              className="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-all"
            >
              + Add Inventory Item
            </button>
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
        <div className="flex gap-4">
          <div className="text-3xl">💡</div>
          <div>
            <h4 className="font-black text-blue-900 mb-2">
              Inventory Manager Responsibilities
            </h4>
            <ul className="text-sm text-blue-800 space-y-1 font-semibold">
              <li>✓ Monitor and maintain accurate stock levels</li>
              <li>✓ Track item expiry dates and issue alerts</li>
              <li>✓ Manage SKU and barcode records</li>
              <li>✓ Report to branch manager on inventory discrepancies</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
