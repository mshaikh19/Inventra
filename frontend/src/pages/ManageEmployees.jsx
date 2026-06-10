import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { getEmployees, createEmployee, updateEmployee, deactivateEmployee } from "../utils/employees";
import { getUserBranches } from "../utils/branches";
import { getUserDisplayName, getDashboardTabFromUser, userHasOwnerAccess } from "../utils/dashboard";
import CustomDropdown from "../components/CustomDropdown";

// Supported Countries with country codes and flags
const COUNTRIES = [
  { name: "India", code: "+91", flag: "🇮🇳" },
  { name: "United States", code: "+1", flag: "🇺🇸" },
  { name: "United Kingdom", code: "+44", flag: "🇬🇧" },
  { name: "United Arab Emirates", code: "+971", flag: "🇦🇪" },
  { name: "Canada", code: "+1", flag: "🇨🇦" },
  { name: "Australia", code: "+61", flag: "🇦🇺" },
  { name: "Singapore", code: "+65", flag: "🇸🇬" },
];

// Step indicator helper components
function StepDot({ n, current, label }) {
  const done = n < current;
  const active = n === current;
  return (
    <div className="flex flex-col items-center gap-1.5 w-24 flex-shrink-0 relative">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${
          done
            ? "bg-emerald-500 text-white shadow-[0_3px_10px_rgba(16,185,129,0.2)]"
            : active
            ? "bg-slate-900 text-white ring-4 ring-slate-900/10 shadow-[0_3px_10px_rgba(15,23,42,0.1)]"
            : "bg-slate-100 text-slate-500 border border-slate-200"
        }`}
      >
        {done ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        ) : n}
      </div>
      <span className={`text-[9px] font-black uppercase tracking-[0.14em] text-center hidden sm:block ${active ? "text-slate-800" : "text-slate-400"}`}>
        {label}
      </span>
    </div>
  );
}

function StepConnector({ done }) {
  return (
    <div className="flex-1 self-center px-1 mb-4">
      <div className={`h-[2.5px] w-full rounded-full transition-colors duration-500 ${done ? "bg-emerald-400" : "bg-slate-200"}`} />
    </div>
  );
}


export default function ManageEmployees({ setActiveTab }) {
  const [employees, setEmployees] = useState(() => {
    try {
      const cached = localStorage.getItem("inventra_employees_list");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [branches, setBranches] = useState(() => {
    try {
      const cached = localStorage.getItem("inventra_branches_list");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem("inventra_employees_list");
      return !cached;
    } catch {
      return true;
    }
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");

  // Modal / Drawer state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "employee",
    branchId: "",
    phone: "",
    phone_country_code: "+91",
    phone_number: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [modalErrors, setModalErrors] = useState({});
  const [phonePrefixOpen, setPhonePrefixOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const inp = (field) =>
    `w-full border ${
      modalErrors[field]
        ? "border-rose-500 bg-rose-50/40 focus:ring-4 focus:ring-rose-900/5 focus:border-rose-500"
        : "border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-500 focus:bg-white"
    } text-slate-900 placeholder:text-slate-400 px-4 py-2.5 rounded-xl font-bold text-sm outline-none transition-all`;

  const ErrMsg = ({ field }) =>
    modalErrors[field] ? <p className="text-rose-600 text-xs font-bold mt-1.5 leading-none">{modalErrors[field]}</p> : null;

  const Label = ({ children }) => (
    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
      {children}
    </label>
  );

  const getBranchIcon = (type) => {
    if (type === "Warehouse") return "🏭";
    if (type === "Franchise") return "🤝";
    if (type === "Depot") return "📦";
    return "🏪";
  };

  const validateStep = (step) => {
    const errs = {};
    if (step === 1) {
      if (!formData.firstName.trim()) errs.firstName = "First name is required.";
      if (!formData.lastName.trim()) errs.lastName = "Last name is required.";
      if (formData.phone_number && formData.phone_number.trim()) {
        const fullPhone = (formData.phone_country_code + formData.phone_number).replace(/\s+/g, "");
        if (!/^\+?[\d\s\-]{7,15}$/.test(fullPhone)) {
          errs.phone = "Please enter a valid phone number.";
        }
      }
    }
    if (step === 2) {
      if (!formData.email.trim()) {
        errs.email = "Email address is required.";
      } else {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(formData.email.trim())) {
          errs.email = "Please enter a valid email address.";
        }
      }
      if (!editingEmployee) {
        if (formData.password && formData.password.length < 6) {
          errs.password = "Password must be at least 6 characters.";
        }
      } else {
        if (formData.password && formData.password.length < 6) {
          errs.password = "Password must be at least 6 characters.";
        }
      }
    }
    if (step === 3) {
      const isManager = formData.role === "manager" || formData.role?.endsWith("_manager");
      if (isManager && !formData.branchId) {
        errs.branchId = "A branch manager must be assigned to a specific branch location.";
      }
    }
    setModalErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(modalStep)) {
      setModalStep(prev => Math.min(4, prev + 1));
    }
  };

  const handlePrevStep = () => {
    setModalStep(prev => Math.max(1, prev - 1));
  };


  const userSession = React.useMemo(() => {
    for (const storage of [localStorage, sessionStorage]) {
      const token = storage.getItem("inventra_token");
      const rawUser = storage.getItem("inventra_user");
      if (token && rawUser) {
        try { return { token, user: JSON.parse(rawUser) }; }
        catch { return { token, user: null }; }
      }
    }
    return null;
  }, []);

  const userDisplayName = getUserDisplayName(userSession?.user, "Owner");
  const isOwner = userHasOwnerAccess(userSession?.user);

  // Load data
  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!phonePrefixOpen) return;
    const handleOutsideClick = (e) => {
      if (!e.target.closest(".custom-phone-prefix-container")) {
        setPhonePrefixOpen(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [phonePrefixOpen]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isModalOpen]);

  const fetchData = async (forceSpinner = false) => {
    if (forceSpinner || employees.length === 0) {
      setLoading(true);
    }
    try {
      const [empData, branchData] = await Promise.all([
        getEmployees(),
        getUserBranches()
      ]);
      let filtered = empData;
      const user = userSession?.user;
      const isManagerScope = user && !userHasOwnerAccess(user) && user.branchId;
      if (isManagerScope) {
        filtered = empData.filter(e => e.branchId === user.branchId);
      }
      setEmployees(filtered);
      let availableBranches = branchData.branches || [];
      if (isManagerScope) {
        availableBranches = availableBranches.filter(b => b.branch_id === user.branchId);
      }
      setBranches(availableBranches);
      try {
        localStorage.setItem("inventra_employees_list", JSON.stringify(empData));
        if (branchData.branches) {
          localStorage.setItem("inventra_branches_list", JSON.stringify(branchData.branches));
        }
      } catch (e) {
        console.warn("Failed to update cache:", e);
      }
    } catch (err) {
      toast.error(err.message || "Failed to load employee directory");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openAddModal = () => {
    setEditingEmployee(null);
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      role: "employee",
      branchId: "",
      phone: "",
      phone_country_code: "+91",
      phone_number: "",
    });
    setModalStep(1);
    setModalErrors({});
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const openEditModal = (emp) => {
    setEditingEmployee(emp);
    const phoneRaw = emp.phone || "";
    let phone_country_code = "+91";
    let phone_number = phoneRaw;
    const m = phoneRaw.match(/^(\+\d+)\s*(.*)$/);
    if (m) {
      phone_country_code = m[1];
      phone_number = m[2] || "";
    }
    setFormData({
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      password: "", 
      role: emp.role,
      branchId: emp.branchId || "",
      phone: emp.phone || "",
      phone_country_code,
      phone_number,
    });
    setModalStep(1);
    setModalErrors({});
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSubmitting(true);
    try {
      let finalPassword = formData.password.trim();
      let wasPasswordAutoGenerated = false;
      if (!editingEmployee && !finalPassword) {
        const cleanName = formData.firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        finalPassword = `${cleanName || "staff"}@staff`;
        wasPasswordAutoGenerated = true;
      }

      const payload = {
        ...formData,
        password: finalPassword,
        phone: (formData.phone_country_code + " " + formData.phone_number.trim()).trim(),
      };
      delete payload.phone_country_code;
      delete payload.phone_number;

      if (editingEmployee) {
        const updates = { ...payload };
        if (!updates.password) {
          delete updates.password;
        }
        // Optimistic list update
        setEmployees(prev => prev.map(e => e._id === editingEmployee._id ? { ...e, ...payload } : e));
        await updateEmployee(editingEmployee._id, updates);
        toast.success(`Successfully updated ${formData.firstName}`);
      } else {
        await createEmployee(payload);
        if (wasPasswordAutoGenerated) {
          toast.success(
            <div className="flex w-full items-start gap-3 px-3.5 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.8rem] border border-emerald-250 bg-emerald-50 text-emerald-700 text-xs font-black shadow-sm">✓</div>
              <div className="min-w-0 flex-1 pr-8 text-left">
                <div className="font-heading text-[0.86rem] font-extrabold tracking-[-0.02em] text-emerald-700">Staff Registered</div>
                <div className="mt-0.5 text-[0.78rem] font-semibold text-emerald-950/85">
                  Successfully added {formData.firstName} as ${(formData.role === "manager" || formData.role?.endsWith("_manager")) ? "Branch Manager" : "Employee"}.
                </div>
                <div className="mt-2 text-[0.74rem] bg-emerald-100/50 border border-emerald-200 p-2 rounded-xl text-emerald-900 font-bold select-all flex justify-between items-center gap-2">
                  <span>Temp Password: <span className="font-mono font-black">{finalPassword}</span></span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(finalPassword);
                      toast.info("Password copied to clipboard!", { autoClose: 1500 });
                    }}
                    className="text-[9px] font-black uppercase text-emerald-700 hover:underline cursor-pointer"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>,
            {
              className: "inventra-toast inventra-toast--success",
              bodyClassName: "inventra-toast__body",
              icon: false,
              closeOnClick: true,
              pauseOnHover: true,
              autoClose: 10000,
            }
          );
        } else {
          toast.success(`Successfully added ${formData.firstName} as ${(formData.role === "manager" || formData.role?.endsWith("_manager")) ? "Branch Manager" : "Employee"}`);
        }
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || "Failed to save staff information");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (emp) => {
    const updatedStatus = !emp.isActive;
    // Optimistic state update
    setEmployees(prev => prev.map(e => e._id === emp._id ? { ...e, isActive: updatedStatus } : e));
    try {
      await updateEmployee(emp._id, { isActive: updatedStatus });
      toast.success(`${emp.firstName} is now ${updatedStatus ? "Active" : "Deactivated"}`);
      fetchData();
    } catch (err) {
      // Revert state
      setEmployees(prev => prev.map(e => e._id === emp._id ? { ...e, isActive: emp.isActive } : e));
      toast.error(err.message || "Failed to change active status");
    }
  };

  const handleDeactivate = async (empId) => {
    if (!window.confirm("Are you sure you want to deactivate this staff member? They will lose system access immediately.")) {
      return;
    }
    const backupEmployees = [...employees];
    // Optimistic delete
    setEmployees(prev => prev.filter(e => e._id !== empId));
    try {
      await deactivateEmployee(empId);
      toast.success("Staff member deactivated successfully");
      fetchData();
    } catch (err) {
      // Revert state
      setEmployees(backupEmployees);
      toast.error(err.message || "Failed to deactivate employee");
    }
  };

  // Metrics
  const getRoleLabel = (role) => {
    if (!role) return "Employee";
    const roleStr = String(role).trim().toLowerCase();
    if (roleStr === "owner" || roleStr === "user") return "Business Owner";
    if (roleStr === "manager") return "Branch Manager";
    if (roleStr === "warehouse_manager") return "Warehouse Manager";
    if (roleStr === "franchise_manager") return "Franchise Manager";
    if (roleStr === "depot_manager") return "Depot Manager";
    if (roleStr === "store_manager") return "Store Manager";
    if (roleStr.endsWith("_manager")) {
      const prefix = roleStr.split("_")[0];
      return prefix.charAt(0).toUpperCase() + prefix.slice(1) + " Manager";
    }
    if (roleStr === "employee" || roleStr === "staff" || roleStr === "cashier") return "Staff / Cashier";
    if (roleStr.endsWith("_employee") || roleStr.endsWith("_staff") || roleStr.endsWith("_cashier")) {
      const parts = roleStr.split("_");
      const prefix = parts[0];
      const suffix = parts[1];
      const formattedSuffix = suffix === "employee" ? "Staff" : suffix.charAt(0).toUpperCase() + suffix.slice(1);
      return prefix.charAt(0).toUpperCase() + prefix.slice(1) + " " + formattedSuffix;
    }
    return String(role).toUpperCase().replace("_", " ");
  };

  const totalStaff = employees.length;
  const activeManagers = employees.filter(e => (e.role === "manager" || e.role?.endsWith("_manager") || (e.role === "owner" && e.branchId)) && e.isActive).length;
  const activeEmployees = employees.filter(e => e.role !== "owner" && e.role !== "manager" && !e.role?.endsWith("_manager") && e.isActive).length;
  const suspendedCount = employees.filter(e => !e.isActive).length;

  const allocatedStaffCount = React.useMemo(() => {
    return branches.reduce((sum, b) => sum + 1 + (Number(b.employee_count) || 0), 0);
  }, [branches]);

  const missingAccountsCount = Math.max(0, allocatedStaffCount - totalStaff);
  // Only show banner when there's a partial mismatch (some accounts exist, but not enough).
  // When totalStaff === 0, the empty-state already covers the "no accounts" message.
  const showMismatchWarning = allocatedStaffCount > totalStaff && totalStaff > 0;

  // Filtered employees list
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch =
      `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase());
    const isEmpManager = emp.role === "manager" || emp.role?.endsWith("_manager") || (emp.role === "owner" && emp.branchId);
    const matchesRole = roleFilter === "all" ||
      (roleFilter === "manager" && isEmpManager) ||
      (roleFilter === "employee" && emp.role !== "owner" && !isEmpManager);
    const matchesBranch = branchFilter === "all" || emp.branchId === branchFilter;
    return matchesSearch && matchesRole && matchesBranch;
  });

  const getBranchName = (branchId) => {
    const branch = branches.find(b => b.branch_id === branchId);
    return branch ? branch.branch_name : "General / All";
  };

  return (
    <div className="min-h-screen bg-[#F6FAF8] text-slate-950 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-emerald-100 bg-white/95 backdrop-blur-xl shadow-sm">
        <div className="flex items-center justify-between gap-4 px-6 md:px-12 py-3.5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab(getDashboardTabFromUser(userSession?.user))}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-950 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-[0.18em]">Dashboard</span>
            </button>
            <div className="hidden sm:block w-px h-7 bg-slate-200" />
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.22em] text-emerald-700">Enterprise Resources</span>
              <h3 className="text-base md:text-lg font-black leading-tight">Staff & Authentication</h3>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden md:inline text-[10px] font-bold text-slate-400 uppercase tracking-widest">{userDisplayName}</span>
            {isOwner && (
              <button
                onClick={openAddModal}
                className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 transition-all hover:scale-[1.02] flex items-center gap-1.5 shadow-md shadow-emerald-100"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Staff
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="px-6 md:px-12 py-6 max-w-7xl mx-auto space-y-6">

        {/* Analytics Cards */}
        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Total Registered */}
          <div className="rounded-2xl border bg-white border-slate-100 p-5 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between">
            <div>
              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Total Registered</span>
              <span className="block text-3xl font-black mt-1 text-slate-700">{totalStaff}</span>
            </div>
            <span className="text-3xl">👤</span>
          </div>

          {/* Positions Allocated */}
          <div className="rounded-2xl border bg-white border-sky-100 p-5 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between bg-sky-50/40">
            <div>
              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Positions Allocated</span>
              <span className="block text-3xl font-black mt-1 text-sky-600">{allocatedStaffCount}</span>
              <span className="block text-[9px] font-bold text-slate-400 mt-1">across {branches.length} branch{branches.length !== 1 ? 'es' : ''}</span>
            </div>
            <span className="text-3xl">🏢</span>
          </div>

          {/* Unregistered */}
          <div className={`rounded-2xl border bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between ${missingAccountsCount > 0 ? 'border-amber-200 bg-amber-50/40' : 'border-slate-100'}`}>
            <div>
              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Unregistered</span>
              <span className={`block text-3xl font-black mt-1 ${missingAccountsCount > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{missingAccountsCount}</span>
              <span className="block text-[9px] font-bold text-slate-400 mt-1">{missingAccountsCount > 0 ? 'missing credentials' : 'all accounted for'}</span>
            </div>
            <span className="text-3xl">{missingAccountsCount > 0 ? '🔓' : '🔒'}</span>
          </div>

          {/* Active Managers */}
          <div className="rounded-2xl border bg-white border-amber-100 p-5 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between bg-amber-50/50">
            <div>
              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Active Managers</span>
              <span className="block text-3xl font-black mt-1 text-amber-600">{activeManagers}</span>
            </div>
            <span className="text-3xl">🎯</span>
          </div>

          {/* Active Employees */}
          <div className="rounded-2xl border bg-white border-emerald-100 p-5 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between bg-emerald-50/50">
            <div>
              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Active Employees</span>
              <span className="block text-3xl font-black mt-1 text-emerald-600">{activeEmployees}</span>
            </div>
            <span className="text-3xl">✅</span>
          </div>

          {/* Deactivated */}
          <div className="rounded-2xl border bg-white border-rose-100 p-5 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between bg-rose-50/50">
            <div>
              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Deactivated</span>
              <span className="block text-3xl font-black mt-1 text-rose-600">{suspendedCount}</span>
            </div>
            <span className="text-3xl">🚫</span>
          </div>
        </section>

        {/* Mismatch Warning Alert Banner */}
        {showMismatchWarning && (
          <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/40 shadow-[0_4px_24px_rgba(245,158,11,0.08)] overflow-hidden">
            {/* Top accent bar */}
            <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />
            <div className="p-6">
              <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">

                {/* Icon + Text */}
                <div className="flex gap-4 items-start flex-1">
                  <div className="h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl shadow-lg shadow-amber-100">
                    🚨
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-200 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Action Required
                      </span>
                    </div>
                    <h4 className="text-base font-black text-slate-900 leading-snug">
                      {missingAccountsCount} Staff Member{missingAccountsCount !== 1 ? 's' : ''} Cannot Access the System
                    </h4>
                    <p className="text-sm font-semibold text-slate-600 leading-relaxed max-w-2xl">
                      Your branch configuration allocates <span className="font-black text-slate-900">{allocatedStaffCount} team positions</span>, but only{" "}
                      <span className="font-black text-slate-900">{totalStaff} login account{totalStaff !== 1 ? 's' : ''}</span> exist in the system.
                      These {missingAccountsCount} unregistered member{missingAccountsCount !== 1 ? 's' : ''} will be locked out until credentials are created.
                    </p>
                  </div>
                </div>

                {/* Progress Visual */}
                <div className="shrink-0 flex flex-col items-center lg:items-end gap-3 w-full lg:w-auto">
                  <div className="flex items-center gap-6 bg-white/70 rounded-2xl border border-amber-100 px-5 py-3.5 shadow-sm">
                    <div className="text-center">
                      <span className="block text-2xl font-black text-emerald-600">{totalStaff}</span>
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mt-0.5">Registered</span>
                    </div>
                    <div className="w-px h-10 bg-slate-200" />
                    <div className="text-center">
                      <span className="block text-2xl font-black text-amber-600">{missingAccountsCount}</span>
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mt-0.5">Missing</span>
                    </div>
                    <div className="w-px h-10 bg-slate-200" />
                    <div className="text-center">
                      <span className="block text-2xl font-black text-slate-700">{allocatedStaffCount}</span>
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mt-0.5">Allocated</span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full lg:w-[240px]">
                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      <span>Credentialed</span>
                      <span>{totalStaff}/{allocatedStaffCount}</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, Math.round((totalStaff / Math.max(1, allocatedStaffCount)) * 100))}%` }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={openAddModal}
                    className="w-full lg:w-auto rounded-xl bg-slate-900 hover:bg-slate-800 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white transition-all hover:scale-[1.02] shadow-sm cursor-pointer flex items-center justify-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Create Missing Credentials
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters and List */}
        <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-6">

          {/* Search and Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search staff by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
              />
            </div>

            {/* Filter Group */}
            <div className="flex flex-wrap items-center gap-3">

              {/* Filter by Role */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Role</span>
                <CustomDropdown
                  value={roleFilter}
                  onChange={setRoleFilter}
                  options={[
                    { value: "all", label: "All Roles" },
                    { value: "manager", label: "Branch Managers" },
                    { value: "employee", label: "Employees / Staff" },
                  ]}
                  theme="emerald"
                  size="sm"
                  buttonClassName="font-bold"
                  className="min-w-[130px]"
                />
              </div>

              {/* Filter by Branch */}
              {isOwner && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Branch</span>
                  <CustomDropdown
                    value={branchFilter}
                    onChange={setBranchFilter}
                    options={[
                      { value: "all", label: "All Branches" },
                      ...branches.map(b => ({ value: b.branch_id, label: b.branch_name })),
                    ]}
                    theme="emerald"
                    size="sm"
                    buttonClassName="font-bold max-w-[200px]"
                    className="min-w-[160px]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Directory Table */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Loading staff records...</span>
            </div>
          ) : filteredEmployees.length === 0 ? (
            allocatedStaffCount > 0 ? (
              /* Allocated but no accounts — high priority notice */
              <div className="rounded-3xl border-2 border-dashed border-amber-200 bg-gradient-to-br from-amber-50/60 to-orange-50/30 p-8 text-center">
                <div className="flex flex-col items-center gap-5 max-w-lg mx-auto">
                  <div className="relative">
                    <div className="w-20 h-20 bg-gradient-to-br from-amber-100 to-orange-100 rounded-3xl flex items-center justify-center text-4xl shadow-md border border-amber-200">
                      🪪
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white font-black text-xs shadow-md border-2 border-white">
                      {allocatedStaffCount}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-200 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Positions Unfilled
                    </span>
                    <h4 className="text-xl font-black text-slate-900 tracking-tight leading-snug">
                      Staff Positions Allocated,<br />But No Accounts Exist Yet
                    </h4>
                    <p className="text-sm font-semibold text-slate-600 leading-relaxed">
                      Your branches have <span className="font-black text-amber-700">{allocatedStaffCount} declared team positions</span>, but zero
                      login credentials have been created. Your staff will not be able to access Inventra until you register their accounts.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                    <button
                      onClick={openAddModal}
                      className="rounded-xl px-6 py-3 text-sm font-black uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-lg hover:scale-[1.02] cursor-pointer flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Create First Account
                    </button>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Start with a Branch Manager to delegate inventory access
                  </p>
                </div>
              </div>
            ) : (
              /* Completely empty — onboarding notice */
              <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/30 p-8 text-center">
                <div className="flex flex-col items-center gap-5 max-w-md mx-auto">
                  <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center text-4xl shadow-inner border border-slate-200">
                    🤝
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-black text-slate-800 tracking-tight">
                      No Staff Accounts Yet
                    </h4>
                    <p className="text-sm font-semibold text-slate-500 leading-relaxed">
                      Register your first team member to grant secure access to Inventra.
                      Managers get full branch control, while employees are scoped to the Billing POS.
                    </p>
                  </div>
                  <button
                    onClick={openAddModal}
                    className="rounded-xl px-6 py-3 text-sm font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-md hover:scale-[1.02] cursor-pointer flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Register First Staff Member
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400 font-black">
                  <tr>
                    <th className="px-5 py-4">Name / Contact</th>
                    <th className="px-5 py-4">Email</th>
                    <th className="px-5 py-4">Role</th>
                    <th className="px-5 py-4">Assigned Location</th>
                    <th className="px-5 py-4 text-center">Status</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                  {filteredEmployees.map((emp) => (
                    <tr key={emp._id} className="hover:bg-slate-50/50 transition-colors group">

                      {/* Name / Avatar */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center font-black text-xs text-white ${
                            emp.role === "owner"
                              ? "bg-slate-900 shadow-sm shadow-slate-200"
                              : (emp.role === "manager" || emp.role?.endsWith("_manager"))
                              ? "bg-amber-500 shadow-sm shadow-amber-100"
                              : "bg-emerald-500 shadow-sm shadow-emerald-100"
                          }`}>
                            {emp.firstName?.[0]?.toUpperCase() || ""}{emp.lastName?.[0]?.toUpperCase() || ""}
                          </div>
                          <div>
                            <span className="block font-black text-slate-900 leading-none">{emp.firstName} {emp.lastName}</span>
                            <span className="block text-[10px] font-bold text-slate-400 mt-1">{emp.phone || "No phone added"}</span>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-5 py-4 font-mono text-xs text-slate-500">{emp.email}</td>

                      {/* Role Badge */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                          emp.role === "owner"
                            ? "bg-slate-900 border border-slate-900 text-white"
                            : (emp.role === "manager" || emp.role?.endsWith("_manager"))
                            ? "bg-amber-50 border border-amber-200 text-amber-700"
                            : "bg-emerald-50 border border-emerald-200 text-emerald-700"
                        }`}>
                          {getRoleLabel(emp.role)}
                        </span>
                      </td>

                      {/* Assigned Location */}
                      <td className="px-5 py-4">
                        <span className="font-bold text-slate-700">{getBranchName(emp.branchId)}</span>
                        {emp.branchId && <span className="block text-[9px] font-bold text-slate-400 mt-0.5">{emp.branchId}</span>}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 text-center">
                        {emp.role === "owner" ? (
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-500">
                            Active
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleActive(emp)}
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider cursor-pointer transition-all hover:scale-105 ${emp.isActive
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700"
                                : "bg-rose-50 border-rose-200 text-rose-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700"
                              }`}
                            title={`Click to ${emp.isActive ? "Deactivate" : "Activate"}`}
                          >
                            {emp.isActive ? "Active" : "Inactive"}
                          </button>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isOwner && (
                            <button
                              onClick={() => openEditModal(emp)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer"
                              title="Edit details"
                            >
                              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                              </svg>
                            </button>
                          )}
                          {emp.role !== "owner" && isOwner && (
                            <button
                              onClick={() => handleDeactivate(emp._id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                              title="Delete staff"
                            >
                              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Centered Step Wizard Modal */}
      {isModalOpen && (() => {
        const STEPS = ["Identity", "Role & Access", "Location", "Review"];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-4xl rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)] flex flex-col relative overflow-hidden">
              {/* Decorative top colored line */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-600" />
              
              {/* Modal Header */}
              <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/40">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-[0.24em] text-emerald-700">
                    {editingEmployee ? "Staff Access Modifier" : "Staff Registration Desk"}
                  </span>
                  <h3 className="text-xl font-black text-slate-950 mt-1">
                    {editingEmployee ? `Modify Access for ${formData.firstName}` : "Register New Staff Member"}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 mt-1 leading-relaxed">
                    {editingEmployee
                      ? "Update operational roles, assign branch visibility, or reset authorization passwords."
                      : "Create secure login credentials, designate access roles, and assign localized branch permissions."
                    }
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl bg-slate-100 hover:bg-slate-200 px-3.5 py-2 text-xs font-black text-slate-600 hover:text-slate-900 cursor-pointer transition-all shrink-0"
                >
                  Close
                </button>
              </div>

              {/* Progress Steps Indicator */}
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/60">
                <div className="flex items-start justify-between w-full max-w-[560px] mx-auto">
                  {STEPS.map((label, i) => (
                    <React.Fragment key={label}>
                      <StepDot n={i + 1} current={modalStep} label={label} />
                      {i < STEPS.length - 1 && <StepConnector done={modalStep > i + 1} />}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Form Content */}
              <div className="p-6">
                {/* Step 1: Personal Details */}
                {modalStep === 1 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Personal Identity Details</h4>
                      <span className="text-[10px] font-bold text-slate-400">* Required fields</span>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      {/* Left: Name fields */}
                      <div className="space-y-4">
                        <div>
                          <Label>First Name <span className="text-rose-500">*</span></Label>
                          <input
                            type="text"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleInputChange}
                            placeholder="e.g. John"
                            className={inp("firstName")}
                            autoFocus
                          />
                          <ErrMsg field="firstName" />
                        </div>
                        <div>
                          <Label>Last Name <span className="text-rose-500">*</span></Label>
                          <input
                            type="text"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleInputChange}
                            placeholder="e.g. Doe"
                            className={inp("lastName")}
                          />
                          <ErrMsg field="lastName" />
                        </div>
                      </div>

                      {/* Right: Phone */}
                      <div className="relative custom-phone-prefix-container">
                        <Label>Phone Contact Number</Label>
                        <div className="flex relative">
                          <div className="absolute left-0 top-0 bottom-0 flex items-center z-10">
                            <button
                              type="button"
                              onClick={() => setPhonePrefixOpen(!phonePrefixOpen)}
                              className="h-full px-3 bg-slate-50/80 border-r border-slate-200 hover:bg-slate-100 rounded-l-xl text-slate-800 font-black text-xs flex items-center gap-1 transition-all cursor-pointer select-none"
                            >
                              <span>{COUNTRIES.find(c => c.code === formData.phone_country_code)?.flag || "🇮🇳"}</span>
                              <span className="text-[11px] font-extrabold">{formData.phone_country_code}</span>
                              <svg className={`w-2.5 h-2.5 text-slate-500 transition-transform ${phonePrefixOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                              </svg>
                            </button>

                            {phonePrefixOpen && (
                              <div className="absolute left-0 top-full mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-2xl p-1.5 z-50 animate-fade-in flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                                {COUNTRIES.map((c) => {
                                  const isSelected = formData.phone_country_code === c.code;
                                  return (
                                    <button
                                      key={c.name}
                                      type="button"
                                      onClick={() => {
                                        setFormData(p => ({
                                          ...p,
                                          phone_country_code: c.code,
                                          phone: (c.code + " " + p.phone_number).trim()
                                        }));
                                        setPhonePrefixOpen(false);
                                      }}
                                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex justify-between items-center ${
                                        isSelected ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                                      }`}
                                    >
                                      <span className="flex items-center gap-1.5">
                                        <span>{c.flag}</span>
                                        <span>{c.name} ({c.code})</span>
                                      </span>
                                      {isSelected && <span className="text-emerald-450 font-black">✓</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <input
                            type="tel"
                            placeholder="98765 43210"
                            value={formData.phone_number}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^\d\s\-]/g, "");
                              setFormData(p => ({
                                ...p,
                                phone_number: val,
                                phone: (p.phone_country_code + " " + val).trim()
                              }));
                            }}
                            className={inp("phone") + " pl-[84px]"}
                          />
                        </div>
                        <ErrMsg field="phone" />
                        <p className="text-[10px] font-semibold text-slate-400 mt-2 leading-relaxed">
                          Used for account recovery and branch contact. Optional but recommended.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Role & System Access */}
                {modalStep === 2 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Credentials & Access Roles</h4>
                      <span className="text-[10px] font-bold text-slate-400">* Required fields</span>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      {/* Left: Email + Password */}
                      <div className="space-y-4">
                        <div>
                          <Label>
                            {(formData.role === "manager" || formData.role?.endsWith("_manager")) ? "Manager Login Email" : "Staff Login Email"} <span className="text-rose-500">*</span>
                          </Label>
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            placeholder={(formData.role === "manager" || formData.role?.endsWith("_manager")) ? "e.g. manager@company.com" : "e.g. cashier@company.com"}
                            className={inp("email")}
                            autoFocus
                          />
                          <ErrMsg field="email" />
                        </div>

                        <div>
                          <Label>
                            {editingEmployee ? "Reset Password (Leave blank to keep current)" : "Access Password (Leave blank to generate automatically)"}
                          </Label>
                          <div className="relative">
                            <input
                              type={showPassword ? "text" : "password"}
                              name="password"
                              value={formData.password}
                              onChange={handleInputChange}
                              placeholder={editingEmployee ? "••••••••" : "Leave blank to auto-generate or min 6 chars"}
                              className={inp("password") + " pr-10"}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              {showPassword ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                </svg>
                              )}
                            </button>
                          </div>
                          <ErrMsg field="password" />
                        </div>
                      </div>

                      {/* Right: Role selection */}
                      <div>
                        <Label>Select Role Assignment <span className="text-rose-500">*</span></Label>
                        <div className="grid grid-cols-1 gap-3 mt-1.5">
                          {formData.role === "owner" ? (
                            <div className="p-4 rounded-2xl border-2 border-slate-900 bg-slate-900 text-white shadow-sm flex items-center gap-4">
                              <span className="text-3xl shrink-0">👑</span>
                              <div>
                                <span className="text-xs font-black block">Business Owner</span>
                                <span className="text-[9.5px] font-semibold mt-0.5 leading-snug text-slate-300 block">
                                  Primary business owner. Full administrative rights.
                                </span>
                              </div>
                            </div>
                          ) : (
                            [
                              { value: "employee", icon: "🧾", title: "Staff / Cashier", desc: "Locks permissions to branch POS checkout & billing operations." },
                              ...(isOwner ? [{ value: "manager", icon: "🎯", title: "Branch Manager", desc: "Manage branch stock transfers, operations, and inventory scopes." }] : []),
                            ].map((r) => {
                              const isSelected = r.value === "manager"
                                ? (formData.role === "manager" || formData.role?.endsWith("_manager"))
                                : formData.role === r.value;
                              return (
                                <button
                                  key={r.value}
                                  type="button"
                                  onClick={() => setFormData(p => ({ ...p, role: r.value }))}
                                  className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-4 ${
                                    isSelected
                                      ? "border-emerald-600 bg-emerald-50/70 text-emerald-900 shadow-sm"
                                      : "border-slate-200 bg-slate-50 hover:border-slate-300 text-slate-700"
                                  }`}
                                >
                                  <span className="text-3xl shrink-0">{r.icon}</span>
                                  <div>
                                    <span className="text-xs font-black block">{r.title}</span>
                                    <span className="text-[9.5px] font-semibold mt-0.5 leading-snug text-slate-400 block">{r.desc}</span>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Location Assignment */}
                {modalStep === 3 && (() => {
                  const isManager = formData.role === "manager" || formData.role?.endsWith("_manager");
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Local Branch Assignment</h4>
                        <span className="text-[10px] font-bold text-slate-400">Select one location</span>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {/* General Option */}
                        {!isManager && (
                          <button
                            type="button"
                            onClick={() => setFormData(p => ({ ...p, branchId: "" }))}
                            className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex gap-3 items-start ${
                              formData.branchId === ""
                                ? "border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm"
                                : "border-slate-200 bg-slate-50 hover:border-slate-300 text-slate-700"
                            }`}
                          >
                            <span className="text-2xl shrink-0">🌍</span>
                            <div>
                              <span className="block text-xs font-black leading-tight">General Access</span>
                              <span className="block text-[9.5px] font-semibold text-slate-400 mt-1 leading-snug">
                                No location locks. All branches.
                              </span>
                            </div>
                          </button>
                        )}

                        {/* Database Branches list */}
                        {branches.map((b) => {
                          const isSelected = formData.branchId === b.branch_id;
                          return (
                            <button
                              key={b.branch_id}
                              type="button"
                              onClick={() => setFormData(p => ({ ...p, branchId: b.branch_id }))}
                              className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex gap-3 items-start ${
                                isSelected
                                  ? "border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm"
                                  : "border-slate-200 bg-slate-50 hover:border-slate-300 text-slate-700"
                              }`}
                            >
                              <span className="text-2xl shrink-0">{getBranchIcon(b.branch_type)}</span>
                              <div className="min-w-0">
                                <span className="block text-xs font-black leading-tight truncate">{b.branch_name}</span>
                                <span className="block text-[9.5px] font-semibold text-slate-400 mt-1 leading-snug">
                                  {b.branch_code || "BRN"} · {b.branch_type || "Store"}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <ErrMsg field="branchId" />
                    </div>
                  );
                })()}

                {/* Step 4: Summary Review */}
                {modalStep === 4 && (() => {
                  const assignedBranch = branches.find(b => b.branch_id === formData.branchId);
                  const isManager = formData.role === "manager" || formData.role?.endsWith("_manager");
                  const managerPerms = ["Full inventory management", "Branch stock transfers", "Employee directory access", "Financial reports & analytics"];
                  const employeePerms = ["Billing POS checkout", "Barcode scanner access", "Sales receipts & invoices"];
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Review & Confirm</h4>
                        <span className="text-[10px] font-bold text-slate-400">All set? Double-check before saving.</span>
                      </div>

                      {/* Two-column layout */}
                      <div className="grid grid-cols-2 gap-3">

                        {/* LEFT: Identity + Branch */}
                        <div className="space-y-3">
                          {/* Identity Card */}
                          <div className="rounded-2xl border border-slate-100 bg-white p-4 flex items-center gap-3">
                            <div className={`h-12 w-12 shrink-0 rounded-xl flex items-center justify-center font-black text-base text-white shadow-md ${isManager ? "bg-gradient-to-br from-amber-400 to-orange-500" : "bg-gradient-to-br from-emerald-400 to-emerald-600"}`}>
                              {formData.firstName?.[0]?.toUpperCase()}{formData.lastName?.[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-black text-slate-900 text-sm leading-tight">{formData.firstName} {formData.lastName}</p>
                              <p className="text-[10px] font-mono text-slate-500 mt-0.5 truncate">{formData.email}</p>
                              <p className="text-[10px] font-bold text-slate-400 mt-0.5">{formData.phone || "No phone added"}</p>
                            </div>
                            <span className={`shrink-0 inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider border ${isManager ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"}`}>
                              {isManager ? "Manager" : "Employee"}
                            </span>
                          </div>

                          {/* Branch Assignment Card */}
                          <div className="rounded-2xl border border-slate-100 bg-white p-4 flex-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2.5">Branch Assignment</p>
                            {assignedBranch ? (
                              <div className="flex items-start gap-3">
                                <span className="text-2xl shrink-0 mt-0.5">{getBranchIcon(assignedBranch.branch_type)}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="font-black text-slate-900 text-sm leading-tight">{assignedBranch.branch_name}</p>
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    <span className="inline-flex rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[9px] font-black text-slate-600">
                                      Code: {assignedBranch.branch_code || "BRN"}
                                    </span>
                                    <span className="inline-flex rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[9px] font-black text-slate-600">
                                      {assignedBranch.branch_type || "Store"}
                                    </span>
                                    {assignedBranch.city && (
                                      <span className="inline-flex rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[9px] font-black text-slate-600">
                                        📍 {assignedBranch.city}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">🌍</span>
                                <div>
                                  <p className="font-black text-slate-900 text-sm">General Access</p>
                                  <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Not locked to any specific branch</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* RIGHT: Role & Access */}
                        <div className={`rounded-2xl border p-4 flex flex-col ${isManager ? "border-amber-100 bg-amber-50/40" : "border-emerald-100 bg-emerald-50/30"}`}>
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">{isManager ? "🎯" : "🧾"}</span>
                            <div>
                              <p className="text-sm font-black text-slate-900">{isManager ? "Branch Manager" : "Staff / Cashier"}</p>
                              <p className="text-[10px] font-semibold text-slate-500">{isManager ? "Full operational access" : "POS-scoped access only"}</p>
                            </div>
                          </div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Access Permissions</p>
                          <div className="space-y-2 flex-1">
                            {(isManager ? managerPerms : employeePerms).map(perm => (
                              <div key={perm} className="flex items-center gap-2">
                                <span className={`w-4 h-4 shrink-0 rounded-full flex items-center justify-center text-[9px] font-black text-white ${isManager ? "bg-amber-400" : "bg-emerald-400"}`}>✓</span>
                                <span className="text-xs font-semibold text-slate-700">{perm}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Password</span>
                            <span className="text-xs font-bold text-slate-600">
                               {editingEmployee ? (formData.password ? "🔄 Resetting" : "✓ Unchanged") : (formData.password ? "🔒 Custom password set" : "⚡ Will be auto-generated")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Modal Footer Controls */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/40 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={modalStep === 1 || submitting}
                  className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 transition-all cursor-pointer disabled:opacity-40"
                >
                  Back
                </button>
                {modalStep < 4 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-md cursor-pointer"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-md cursor-pointer disabled:opacity-60"
                  >
                    {submitting ? "Saving..." : editingEmployee ? "Update Credentials" : "Register Staff"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
