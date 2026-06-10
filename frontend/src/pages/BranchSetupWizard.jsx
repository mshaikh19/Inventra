import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { createBranch, getUserBranches, deactivateBranch, updateBranch } from "../utils/branches";
import { getDashboardTabFromUser } from "../utils/dashboard";

// ── Supported Countries with country codes and flags ──────────────────────────
const COUNTRIES = [
  { name: "India", code: "+91", flag: "🇮🇳" },
  { name: "United States", code: "+1", flag: "🇺🇸" },
  { name: "United Kingdom", code: "+44", flag: "🇬🇧" },
  { name: "United Arab Emirates", code: "+971", flag: "🇦🇪" },
  { name: "Canada", code: "+1", flag: "🇨🇦" },
  { name: "Australia", code: "+61", flag: "🇦🇺" },
  { name: "Singapore", code: "+65", flag: "🇸🇬" },
];

// ── Indian states list ──────────────────────────────────────────────────────
const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman & Nicobar Islands","Chandigarh","Dadra & Nagar Haveli",
  "Daman & Diu","Delhi","Jammu & Kashmir","Ladakh","Lakshadweep","Puducherry",
];

// City to State mapper for smooth Indian location detection
const CITY_TO_STATE_MAP = {
  "mumbai": "Maharashtra",
  "pune": "Maharashtra",
  "nagpur": "Maharashtra",
  "nashik": "Maharashtra",
  "thane": "Maharashtra",
  "navi mumbai": "Maharashtra",
  "kolhapur": "Maharashtra",
  "solapur": "Maharashtra",
  "aurangabad": "Maharashtra",
  "amravati": "Maharashtra",
  "bangalore": "Karnataka",
  "bengaluru": "Karnataka",
  "mysore": "Karnataka",
  "mysuru": "Karnataka",
  "mangalore": "Karnataka",
  "mangaluru": "Karnataka",
  "hubli": "Karnataka",
  "hubballi": "Karnataka",
  "belgaum": "Karnataka",
  "belagavi": "Karnataka",
  "chennai": "Tamil Nadu",
  "coimbatore": "Tamil Nadu",
  "madurai": "Tamil Nadu",
  "trichy": "Tamil Nadu",
  "tiruchirappalli": "Tamil Nadu",
  "salem": "Tamil Nadu",
  "tirunelveli": "Tamil Nadu",
  "delhi": "Delhi",
  "new delhi": "Delhi",
  "noida": "Uttar Pradesh",
  "greater noida": "Uttar Pradesh",
  "ghaziabad": "Uttar Pradesh",
  "lucknow": "Uttar Pradesh",
  "kanpur": "Uttar Pradesh",
  "agra": "Uttar Pradesh",
  "varanasi": "Uttar Pradesh",
  "prayagraj": "Uttar Pradesh",
  "allahabad": "Uttar Pradesh",
  "meerut": "Uttar Pradesh",
  "bareilly": "Uttar Pradesh",
  "aligarh": "Uttar Pradesh",
  "moradabad": "Uttar Pradesh",
  "gurgaon": "Haryana",
  "gurugram": "Haryana",
  "faridabad": "Haryana",
  "panipat": "Haryana",
  "ambala": "Haryana",
  "rohtak": "Haryana",
  "kolkata": "West Bengal",
  "howrah": "West Bengal",
  "darjeeling": "West Bengal",
  "durgapur": "West Bengal",
  "siliguri": "West Bengal",
  "asansol": "West Bengal",
  "hyderabad": "Telangana",
  "warangal": "Telangana",
  "secunderabad": "Telangana",
  "nizamabad": "Telangana",
  "ahmedabad": "Gujarat",
  "surat": "Gujarat",
  "vadodara": "Gujarat",
  "rajkot": "Gujarat",
  "bhavnagar": "Gujarat",
  "jamnagar": "Gujarat",
  "jaipur": "Rajasthan",
  "jodhpur": "Rajasthan",
  "udaipur": "Rajasthan",
  "kota": "Rajasthan",
  "bikaner": "Rajasthan",
  "ajmer": "Rajasthan",
  "indore": "Madhya Pradesh",
  "bhopal": "Madhya Pradesh",
  "gwalior": "Madhya Pradesh",
  "jabalpur": "Madhya Pradesh",
  "ujjain": "Madhya Pradesh",
  "chandigarh": "Chandigarh",
  "amritsar": "Punjab",
  "ludhiana": "Punjab",
  "jalandhar": "Punjab",
  "patiala": "Punjab",
  "kochi": "Kerala",
  "trivandrum": "Kerala",
  "thiruvananthapuram": "Kerala",
  "calicut": "Kerala",
  "kozhikode": "Kerala",
  "thrissur": "Kerala",
  "kollam": "Kerala",
  "patna": "Bihar",
  "gaya": "Bihar",
  "muzaffarpur": "Bihar",
  "bhagalpur": "Bihar",
  "ranchi": "Jharkhand",
  "jamshedpur": "Jharkhand",
  "dhanbad": "Jharkhand",
  "bhubaneswar": "Odisha",
  "cuttack": "Odisha",
  "puri": "Odisha",
  "rourkela": "Odisha",
  "guwahati": "Assam",
  "dibrugarh": "Assam",
  "silchar": "Assam",
  "jorhat": "Assam",
  "dehradun": "Uttarakhand",
  "haridwar": "Uttarakhand",
  "nainital": "Uttarakhand",
  "rishikesh": "Uttarakhand",
  "shimla": "Himachal Pradesh",
  "dharamshala": "Himachal Pradesh",
  "manali": "Himachal Pradesh",
  "raipur": "Chhattisgarh",
  "bilaspur": "Chhattisgarh",
  "bhilai": "Chhattisgarh",
  "panaji": "Goa",
  "margao": "Goa",
  "vasco da gama": "Goa",
  "srinagar": "Jammu & Kashmir",
  "jammu": "Jammu & Kashmir",
  "visakhapatnam": "Andhra Pradesh",
  "vijayawada": "Andhra Pradesh",
  "guntur": "Andhra Pradesh",
  "tirupati": "Andhra Pradesh",
  "nellore": "Andhra Pradesh",
};

function getStateForCity(city) {
  if (!city) return "";
  const normalized = city.trim().toLowerCase();
  return CITY_TO_STATE_MAP[normalized] || "";
}

const BRANCH_TYPES = [
  { value: "Store",     icon: "🏪", desc: "Retail outlet" },
  { value: "Warehouse", icon: "🏭", desc: "Storage hub" },
  { value: "Franchise", icon: "🤝", desc: "Licensed store" },
  { value: "Depot",     icon: "📦", desc: "Wholesale depot" },
];

const WORKING_HOURS_PRESETS = [
  "8AM-8PM", "9AM-9PM", "9AM-6PM", "10AM-10PM", "24 Hours",
];

const EMPTY_FORM = {
  branch_name:        "",
  branch_code:        "",
  branch_type:        "Store",
  address:            "",
  city:               "",
  state:              "",
  pincode:            "",
  country:            "India",
  phone:              "",
  phone_country_code: "+91",
  phone_number:       "",
  manager_name:       "",
  manager_email:      "",
  manager_password:   "",
  employee_count:     0,
  working_hours:      "9AM-9PM",
  opening_date:       "",
  gstin:              "",
};

function getDraftForm(form) {
  return {
    ...form,
    manager_password: "",
  };
}


// Auto-generate an intelligent branch code from the name
function autoCode(name) {
  if (!name) return "";
  const clean = name.replace(/[^a-zA-Z0-9\s]/g, "").trim().toUpperCase();
  const words = clean.split(/\s+/).filter(w => !["AND", "THE", "OF", "IN", "AT", "FOR", "BY", "WITH"].includes(w));
  
  if (words.length === 0) return "BR-01";
  
  const dict = {
    // Cities
    "MUMBAI": "MUM", "PUNE": "PUN", "DELHI": "DEL", "BANGALORE": "BLR", "BENGALURU": "BLR",
    "KOLKATA": "KOL", "CHENNAI": "MAA", "HYDERABAD": "HYD", "AHMEDABAD": "AMD", "JAIPUR": "JPR",
    // Descriptors
    "FLAGSHIP": "FLG", "BOUTIQUE": "BTQ", "STORE": "STR", "WAREHOUSE": "WH", "DEPOT": "DEP",
    "FRANCHISE": "FRN", "OUTLET": "OUT", "OFFICE": "OFF", "HEADQUARTERS": "HQ", "CENTRAL": "CTL",
    "RETAIL": "RTL", "EXPERIENCE": "EXP", "STUDIO": "STD"
  };

  const translate = (w) => dict[w] || (w.length <= 4 ? w : w.slice(0, 3));

  if (words.length === 1) {
    const w = words[0];
    return w.length <= 6 ? `${w}-01` : `${w.slice(0, 4)}-01`;
  }
  
  const parts = words.map(translate);
  if (parts[0].length > 5) parts[0] = parts[0].slice(0, 4);

  return parts.join("-").slice(0, 12);
}

const getDynamicLabels = (type) => {
  switch (type) {
    case "Warehouse":
      return {
        nameLabel: "Warehouse Name",
        namePlaceholder: "e.g. Western Zone Storage Hub",
        codeLabel: "Warehouse Code",
        codePlaceholder: "e.g. WH-WEST-01",
        addressLabel: "Warehouse Address",
        addressPlaceholder: "Facility Area, Plot No., Sector...",
        cityLabel: "City / Logistics Node",
        cityPlaceholder: "e.g. Bhiwandi",
        stateLabel: "State",
        countryLabel: "Country",
        pincodeLabel: "Pincode / Postal Code",
        pincodePlaceholder: "e.g. 421302",
        managerLabel: "Warehouse Manager Name",
        placeholderName: "e.g. Satish Kumar",
        phoneLabel: "Warehouse Contact Number",
        phonePlaceholder: "e.g. 98765 43210",
        gstLabel: "GSTIN / Storage License (Optional)",
        gstPlaceholder: "e.g. 27AAAAA0000A1Z5 / WH-LIC-99",
        staffLabel: "Logistics / Labor Staff Count",
        hoursLabel: "Warehouse Shift Timings",
        placeholderHours: "e.g. 24 Hours or 9AM-6PM",
        openingDateLabel: "Commissioning Date",
        titleLabel: "Warehouse",
        addressSectionLabel: "Storage Facility Address",
        managerSectionLabel: "Warehouse Manager & Contact",
        gstSectionLabel: "GSTIN / Storage License",
        teamSectionLabel: "Logistics & Labor Staff",
        hoursSectionLabel: "Shift Timings",
        verificationHeader: "Warehouse Verification",
      };
    case "Franchise":
      return {
        nameLabel: "Franchise Name",
        namePlaceholder: "e.g. Inventra Franchise - CP",
        codeLabel: "Franchise Code",
        codePlaceholder: "e.g. FR-CP-05",
        addressLabel: "Franchise Address",
        addressPlaceholder: "Shop No., Mall/Market Name, Street...",
        cityLabel: "Franchise City",
        cityPlaceholder: "e.g. New Delhi",
        stateLabel: "State",
        countryLabel: "Country",
        pincodeLabel: "Pincode",
        pincodePlaceholder: "e.g. 110001",
        managerLabel: "Franchise Owner / Operator Name",
        placeholderName: "e.g. Priya Sharma",
        phoneLabel: "Franchise Contact Number",
        phonePlaceholder: "e.g. 98765 43210",
        gstLabel: "GSTIN / Trade License (Optional)",
        gstPlaceholder: "e.g. 07AAAAA0000A1Z5 / TR-FR-12",
        staffLabel: "Franchise Staff Count",
        hoursLabel: "Franchise Operating Hours",
        placeholderHours: "e.g. 10AM-10PM",
        openingDateLabel: "Franchise Launch Date",
        titleLabel: "Franchise",
        addressSectionLabel: "Franchise Retail Address",
        managerSectionLabel: "Franchise Owner & Contact",
        gstSectionLabel: "GSTIN / Trade License",
        teamSectionLabel: "Franchise Team Size",
        hoursSectionLabel: "Operating Hours",
        verificationHeader: "Franchise Verification",
      };
    case "Depot":
      return {
        nameLabel: "Depot Name",
        namePlaceholder: "e.g. Central Wholesalers Depot",
        codeLabel: "Depot Code",
        codePlaceholder: "e.g. DEP-CEN-03",
        addressLabel: "Depot Address",
        addressPlaceholder: "Industrial Area, Warehouse Complex...",
        cityLabel: "Depot City",
        cityPlaceholder: "e.g. Chennai",
        stateLabel: "State",
        countryLabel: "Country",
        pincodeLabel: "Pincode / Zip Code",
        pincodePlaceholder: "e.g. 600001",
        managerLabel: "Depot Manager Name",
        placeholderName: "e.g. Anil Deshmukh",
        phoneLabel: "Depot Contact Number",
        phonePlaceholder: "e.g. 98765 43210",
        gstLabel: "GSTIN / Depot Registration (Optional)",
        gstPlaceholder: "e.g. 33AAAAA0000A1Z5 / DEP-REG-88",
        staffLabel: "Depot Staff Count",
        hoursLabel: "Depot Operating Hours",
        placeholderHours: "e.g. 8AM-8PM",
        openingDateLabel: "Depot Opening Date",
        titleLabel: "Depot",
        addressSectionLabel: "Depot Facility Address",
        managerSectionLabel: "Depot Manager & Contact",
        gstSectionLabel: "GSTIN / Depot Registration",
        teamSectionLabel: "Depot Operations Team",
        hoursSectionLabel: "Operating Hours",
        verificationHeader: "Depot Verification",
      };
    case "Store":
    default:
      return {
        nameLabel: "Store Name",
        namePlaceholder: "e.g. Inventra Flagship Store",
        codeLabel: "Store Code",
        codePlaceholder: "e.g. STR-MUM-02",
        addressLabel: "Store Address",
        addressPlaceholder: "Shop No., Street Address, Area...",
        cityLabel: "City",
        cityPlaceholder: "e.g. Mumbai",
        stateLabel: "State",
        countryLabel: "Country",
        pincodeLabel: "Pincode",
        pincodePlaceholder: "e.g. 400001",
        managerLabel: "Branch Manager Name",
        placeholderName: "e.g. Ritesh Deshmukh",
        phoneLabel: "Store Contact Number",
        phonePlaceholder: "e.g. 98765 43210",
        gstLabel: "GSTIN (Optional)",
        gstPlaceholder: "e.g. 27AAAAA0000A1Z5",
        staffLabel: "Store Staff Count",
        hoursLabel: "Store Operating Hours",
        placeholderHours: "e.g. 9AM-9PM",
        openingDateLabel: "Store Opening Date",
        titleLabel: "Store",
        addressSectionLabel: "Store Address",
        managerSectionLabel: "Branch Manager & Contact",
        gstSectionLabel: "GST Identification (GSTIN)",
        teamSectionLabel: "Store Staff Members",
        hoursSectionLabel: "Operating Hours",
        verificationHeader: "Store Verification",
      };
  }
};

// Step indicator dot (Larger, elegant, perfectly contrastive on white background)
function StepDot({ n, current, label }) {
  const done = n < current;
  const active = n === current;
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 relative">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${
          done
            ? "bg-emerald-500 text-white shadow-[0_3px_10px_rgba(16,185,129,0.2)]"
            : active
            ? "bg-slate-900 text-white ring-4 ring-slate-900/10 shadow-[0_3px_10px_rgba(15,23,42,0.1)]"
            : "bg-slate-100 text-slate-400 border border-slate-200/80"
        }`}
      >
        {done ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        ) : n}
      </div>
      <span className={`text-[10px] font-black uppercase tracking-[0.14em] hidden sm:block ${active ? "text-slate-800" : "text-slate-400"}`}>
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

const getBranchDraftKey = () => {
  if (typeof window === "undefined") return "inventra-branch-setup-draft";
  try {
    const rawUser = window.localStorage.getItem("inventra_user") || window.sessionStorage.getItem("inventra_user");
    if (rawUser) {
      const user = JSON.parse(rawUser);
      const userId = user.id || user._id || user.email || "default";
      return `inventra-branch-setup-draft_${userId}`;
    }
  } catch (e) {
    // ignore
  }
  return "inventra-branch-setup-draft";
};

const loadBranchDraft = () => {
  if (typeof window === "undefined") {
    return { step: 1, form: EMPTY_FORM };
  }
  try {
    const rawDraft = window.localStorage.getItem(getBranchDraftKey());
    if (!rawDraft) return { step: 1, form: EMPTY_FORM };
    const parsed = JSON.parse(rawDraft);
    const formVal = { ...EMPTY_FORM, ...(parsed.form || {}) };
    formVal.manager_password = "";
    
    // Auto-parse raw phone string back into prefix and number parts if needed
    if (formVal.phone && !formVal.phone_number) {
      const trimmed = formVal.phone.trim();
      const match = trimmed.match(/^(\+\d+)\s*(.*)$/);
      if (match) {
        formVal.phone_country_code = match[1];
        formVal.phone_number = match[2];
      } else {
        formVal.phone_number = trimmed;
      }
    }
    return {
      step: parsed.step ?? 1,
      form: formVal,
    };
  } catch {
    return { step: 1, form: EMPTY_FORM };
  }
};

export default function BranchSetupWizard({ setActiveTab }) {
  const draftState = React.useMemo(() => loadBranchDraft(), []);
  const [step, setStep] = useState(draftState.step);
  const [form, setForm] = useState(draftState.form);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [createdBranch, setCreatedBranch] = useState(null);
  
  const labels = getDynamicLabels(form.branch_type);
  
  // Onboarding Hub visual states
  const [createdBranchesList, setCreatedBranchesList] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expectedBranches, setExpectedBranches] = useState(1);
  const [declaredEmployees, setDeclaredEmployees] = useState(0);

  const [isEditingExpectations, setIsEditingExpectations] = useState(false);
  const [tempExpectedBranches, setTempExpectedBranches] = useState(1);
  const [tempDeclaredEmployees, setTempDeclaredEmployees] = useState(0);

  useEffect(() => {
    setTempExpectedBranches(expectedBranches);
  }, [expectedBranches]);

  useEffect(() => {
    setTempDeclaredEmployees(declaredEmployees);
  }, [declaredEmployees]);

  const handleSaveExpectations = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("inventra_token") || sessionStorage.getItem("inventra_token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/branches/expectations/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          expected_branches: Number(tempExpectedBranches),
          expected_employees: Number(tempDeclaredEmployees)
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Failed to update details");
      }
      toast.success("Business details updated successfully!");
      setExpectedBranches(Number(tempExpectedBranches));
      setDeclaredEmployees(Number(tempDeclaredEmployees));
      setIsEditingExpectations(false);
      syncBranches();
    } catch (err) {
      toast.error(err.message || "Failed to save details");
    } finally {
      setLoading(false);
    }
  };

  const syncBranches = () => {
    getUserBranches()
      .then((data) => {
        if (data && data.branches) {
          setCreatedBranchesList(data.branches);
        }
        if (data && typeof data.expected_branches === "number") {
          setExpectedBranches(data.expected_branches);
        }
        if (data && typeof data.expected_employees === "number") {
          setDeclaredEmployees(data.expected_employees);
          setForm((prev) => {
            if (prev.employee_count === 1 || prev.employee_count === 0) {
              const branches = data.branches || [];
              const assigned = branches.reduce((acc, b) => acc + (Number(b.employee_count) || 0), 0);
              const expectedB = data.expected_branches ?? 1;
              return {
                ...prev,
                employee_count: Math.max(0, data.expected_employees - expectedB - assigned)
              };
            }
            return prev;
          });
        }
      })
      .catch((err) => console.error("Failed to load branches in onboarding hub:", err));
  };

  useEffect(() => {
    syncBranches();
  }, []);

  // Sync draft state to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        getBranchDraftKey(),
        JSON.stringify({ step, form: getDraftForm(form) })
      );
    }
  }, [step, form]);

  // Custom Dropdowns UI states
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState("");
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [phonePrefixOpen, setPhonePrefixOpen] = useState(false);

  useEffect(() => {
    if (!dropdownOpen && !countryDropdownOpen && !phonePrefixOpen) return;
    const handleOutsideClick = (e) => {
      if (!e.target.closest(".custom-dropdown-container")) {
        setDropdownOpen(false);
      }
      if (!e.target.closest(".custom-country-container")) {
        setCountryDropdownOpen(false);
      }
      if (!e.target.closest(".custom-phone-prefix-container")) {
        setPhonePrefixOpen(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [dropdownOpen, countryDropdownOpen, phonePrefixOpen]);

  const filteredStates = INDIAN_STATES.filter((stateName) =>
    stateName.toLowerCase().includes(dropdownSearch.toLowerCase())
  );

  // Get stored user data
  const storedUser = (() => {
    try {
      const raw = localStorage.getItem("inventra_user") || sessionStorage.getItem("inventra_user");
      return JSON.parse(raw || "{}");
    }
    catch { return {}; }
  })();

  // Auto-generate branch code when name or code status changes
  useEffect(() => {
    if (form.branch_name && !form.branch_code) {
      setForm((p) => ({ ...p, branch_code: autoCode(form.branch_name) }));
    }
  }, [form.branch_name, form.branch_code]);

  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => { const n = { ...p }; delete n[k]; return n; });
  };

  const handleLogout = () => {
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem("inventra_token");
      storage.removeItem("inventra_user");
    }
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/");
      sessionStorage.removeItem("inventra_dashboard_section");
    }
    setActiveTab("home");
  };

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = (s) => {
    const e = {};
    const currentLabels = getDynamicLabels(form.branch_type);
    if (s === 1) {
      if (!form.branch_name.trim()) e.branch_name = `${currentLabels.nameLabel} is required`;
      if (!form.branch_code.trim()) e.branch_code = `${currentLabels.codeLabel} is required`;
    }
    if (s === 2) {
      if (!form.address.trim()) e.address = `${currentLabels.addressLabel} is required`;
      if (!form.city.trim()) e.city = `${currentLabels.cityLabel} is required`;
      if (!form.state) e.state = "State is required";
      if (!form.country) e.country = "Country is required";
      if (!form.pincode.trim()) e.pincode = `${currentLabels.pincodeLabel} is required`;
      else if (!/^\d{4,10}$/.test(form.pincode)) e.pincode = `Enter a valid ${currentLabels.pincodeLabel.toLowerCase()}`;
    }
    if (s === 3) {
      if (!form.phone_number.trim()) e.phone = `${currentLabels.phoneLabel} is required`;
      else if (!/^\+?[\d\s\-]{7,15}$/.test((form.phone_country_code + form.phone_number).replace(/\s+/g, ""))) e.phone = `Enter a valid ${currentLabels.phoneLabel.toLowerCase()}`;
      if (!form.manager_name.trim()) e.manager_name = `${currentLabels.managerLabel} is required`;
      if (form.manager_email && form.manager_email.trim()) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.manager_email.trim())) {
          e.manager_email = "Enter a valid email address";
        }
      }
    }
    return e;
  };

  const goNext = () => {
    const e = validate(step);
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setStep((s) => Math.min(4, s + 1));
  };

  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const showErrorToast = (title, message) => {
    const content = (
      <div className="flex w-full items-center gap-3 px-3.5 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.8rem] border border-rose-250 bg-rose-50 text-rose-700 text-xs font-black shadow-sm">
          !
        </div>
        <div className="min-w-0 flex-1 pr-8 text-left">
          <div className="font-heading text-[0.86rem] font-extrabold tracking-[-0.02em] sm:text-[0.9rem] text-rose-700">
            {title}
          </div>
          <div className="mt-0.5 w-full max-w-none text-[0.78rem] font-semibold leading-[0.95rem] break-words sm:text-[0.82rem] sm:leading-[1rem] text-rose-950/80">
            {message}
          </div>
        </div>
      </div>
    );

    toast.error(content, {
      className: "inventra-toast inventra-toast--error",
      bodyClassName: "inventra-toast__body",
      icon: false,
      closeOnClick: false,
      pauseOnHover: true,
      autoClose: 4200,
    });
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const e = validate(step);
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      const payload = {
        branch_name:    form.branch_name.trim(),
        branch_code:    form.branch_code.trim().toUpperCase(),
        branch_type:    form.branch_type,
        address:        form.address.trim(),
        city:           form.city.trim(),
        state:          form.state,
        country:        form.country,
        pincode:        form.pincode.trim(),
        phone:          (form.phone_country_code + " " + form.phone_number.trim()).trim(),
        manager_name:   form.manager_name.trim(),
        manager_email:  form.manager_email.trim() || null,
        manager_password: form.manager_password || null,
        employee_count: form.employee_count !== "" && form.employee_count !== undefined ? Number(form.employee_count) : 0,
        working_hours:  form.working_hours,
        opening_date:   form.opening_date || null,
        gstin:          form.branch_type === "Warehouse" ? null : (form.gstin.trim() || null),
        status:         "Active",
      };
      let branch;
      if (form._id) {
        branch = await updateBranch(form._id, payload);
      } else {
        branch = await createBranch(payload);
      }
      setCreatedBranch(branch);
      syncBranches();
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(getBranchDraftKey());
      }
      setForm({
        ...EMPTY_FORM,
        employee_count: 0
      });
      setStep(1);
      setShowCreateForm(false);
    } catch (err) {
      const rawMsg = err.message || "";
      let errMsg = rawMsg;
      let errTitle = "Connection Failed";

      if (rawMsg === "Failed to fetch") {
        errMsg = "Unable to reach the server. Please verify your connection or check if the backend service is running.";
      } else if (rawMsg.toLowerCase().includes("token") || rawMsg.toLowerCase().includes("unauthorized") || rawMsg.toLowerCase().includes("expired")) {
        errTitle = "Session Expired";
        errMsg = "Your secure session has expired. Gracefully redirecting you to sign in again while keeping your draft safe.";
        
        // Log out safely
        for (const storage of [localStorage, sessionStorage]) {
          storage.removeItem("inventra_token");
          storage.removeItem("inventra_user");
        }
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", "/");
          sessionStorage.removeItem("inventra_dashboard_section");
        }
        setActiveTab("home");
      } else {
        errTitle = "Launch Failed";
      }

      showErrorToast(errTitle, errMsg);
    } finally {
      setLoading(false);
    }
  };

  const goToDashboard = () => {
    setActiveTab(getDashboardTabFromUser(storedUser));
  };

  // ── Input class (Optimized for larger font and breathing room) ──────────────
  const inp = (field) =>
    `w-full border ${
      errors[field] ? "border-rose-400 bg-rose-50/40" : "border-slate-200 bg-slate-50/50"
    } text-slate-900 placeholder:text-slate-400 px-4 py-2.5 rounded-xl font-bold text-sm outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-500 focus:bg-white transition-all`;

  const ErrMsg = ({ field }) =>
    errors[field] ? <p className="text-rose-600 text-xs font-bold mt-1.5 leading-none">{errors[field]}</p> : null;

  const Label = ({ children }) => (
    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">
      {children}
    </label>
  );

  const handleCompleteOnboarding = () => {
    const userId = storedUser.id || storedUser._id || storedUser.email || "default";
    localStorage.setItem(`inventra_onboarding_completed_${userId}`, "true");
    localStorage.removeItem(getBranchDraftKey());
    setActiveTab(getDashboardTabFromUser(storedUser));
  };

  const handleDeleteBranch = async (branchId) => {
    if (!window.confirm("Are you sure you want to remove this branch?")) return;
    setLoading(true);
    try {
      await deactivateBranch(branchId);
      syncBranches();
    } catch (err) {
      alert(err.message || "Failed to remove branch");
    } finally {
      setLoading(false);
    }
  };

  const handleEditBranch = async (branch) => {
    // Prepare the form with existing branch data and open the wizard for edit
    try {
      setLoading(true);

      const phoneRaw = branch.phone || "";
      let phone_country_code = "+91";
      let phone_number = phoneRaw;
      const m = phoneRaw.match(/^(\+\d+)\s*(.*)$/);
      if (m) {
        phone_country_code = m[1];
        phone_number = m[2] || "";
      }

      setForm({
        branch_name: branch.branch_name || "",
        branch_code: branch.branch_code || "",
        branch_type: branch.branch_type || "Store",
        address: branch.address || "",
        city: branch.city || "",
        state: branch.state || "",
        pincode: branch.pincode || "",
        country: branch.country || "India",
        phone: phoneRaw,
        phone_country_code,
        phone_number,
        manager_name: branch.manager_name || "",
        manager_email: "",
        manager_password: "",
        employee_count: branch.employee_count || 1,
        working_hours: branch.working_hours || "9AM-9PM",
        opening_date: branch.opening_date || "",
        gstin: branch.gstin || "",
        _id: branch._id || branch.branch_id || null,
      });

      setCreatedBranch(branch);
      setStep(1);
      setShowCreateForm(true);
    } catch (err) {
      showErrorToast("Edit Failed", err.message || "Unable to open edit form");
    } finally {
      setLoading(false);
    }
  };

  const renderOnboardingHub = () => {
    const bizName = storedUser.businessName || storedUser.company || "Your Business";
    const tierName = storedUser.classification || "small";
    const isListEmpty = createdBranchesList.length === 0;

    const assignedEmployees = createdBranchesList.reduce((acc, b) => acc + (Number(b.employee_count) || 0), 0);

    const isBranchCountComplete = createdBranchesList.length >= expectedBranches;
    const isEmployeeCountValid = assignedEmployees === Math.max(0, declaredEmployees - createdBranchesList.length);
    const isComplete = isBranchCountComplete && isEmployeeCountValid;

    return (
      <div className="min-h-screen w-full bg-white flex flex-col pt-[52px] pb-2 px-4 sm:px-6 relative overflow-x-hidden">
        {/* ── Branded White Navbar ────────────────── */}
        <header className="fixed top-0 left-0 right-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur-xl px-5 sm:px-8 py-2 flex justify-between items-center shadow-sm select-none">
          <div className="flex items-center gap-3">
            <span className="text-[14px] font-black uppercase tracking-[0.25em] text-slate-950">INVENTRA</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] text-slate-600">
              Onboarding Hub
            </span>
          </div>

          <div className="hidden md:block text-slate-600 text-xs font-bold tracking-wide">
            ✨ Welcome, <span className="text-slate-900 font-extrabold">{storedUser.firstName || "Manager"}</span>! Complete setup to initialize operations.
          </div>

          <button
            onClick={handleLogout}
            className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700 transition-all cursor-pointer select-none"
          >
            Sign Out
          </button>
        </header>

        {/* ── Network Hub Main Workspace ── */}
        <div className="flex-1 w-full flex flex-col justify-center items-center mt-4">
          <div className="w-full max-w-[940px] flex flex-col px-1 sm:px-2">
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 flex flex-col relative overflow-hidden">
              
              {/* Decorative top colored line */}
              <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: "#0F172A" }} />
              
              <div className="px-6 sm:px-8 py-4 border-b border-slate-100 bg-slate-50/40">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center flex-wrap gap-2.5 mb-1">
                      <h1 className="text-xl font-black text-slate-900 uppercase tracking-wide leading-tight">
                        {bizName}
                      </h1>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[8.5px] font-black uppercase tracking-[0.12em] shrink-0 whitespace-nowrap ${
                        tierName === "medium"
                           ? "bg-amber-50 border-amber-200 text-amber-800"
                          : tierName === "large"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : "bg-sky-50 border-sky-200 text-sky-800"
                      }`}>
                        {tierName.toUpperCase()} TIER
                      </span>
                    </div>
                    <p className="text-slate-600 text-xs font-semibold leading-normal">
                      Initialize and orchestrate your business's branch networks. Scopes inventory and analytics.
                    </p>
                    {isEditingExpectations ? (
                      <div className="mt-3 p-3 bg-white border border-slate-200 rounded-2xl flex flex-wrap items-center gap-4 text-xs font-bold shadow-sm max-w-xl">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-[10px] font-black uppercase tracking-wider">Expected Branches:</span>
                          <input
                            type="number"
                            min={1}
                            value={tempExpectedBranches}
                            onChange={(e) => setTempExpectedBranches(Number(e.target.value))}
                            className="w-16 border border-slate-200 bg-slate-50 px-2 py-1 rounded-lg text-slate-900 font-bold text-center outline-none focus:border-slate-400 focus:bg-white transition-all"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-[10px] font-black uppercase tracking-wider">Declared Employees:</span>
                          <input
                            type="number"
                            min={0}
                            value={tempDeclaredEmployees}
                            onChange={(e) => setTempDeclaredEmployees(Number(e.target.value))}
                            className="w-20 border border-slate-200 bg-slate-50 px-2 py-1 rounded-lg text-slate-900 font-bold text-center outline-none focus:border-slate-400 focus:bg-white transition-all"
                          />
                        </div>
                        <div className="flex items-center gap-2 sm:ml-auto">
                          <button
                            onClick={handleSaveExpectations}
                            disabled={loading}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                          >
                            {loading ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={() => setIsEditingExpectations(false)}
                            disabled={loading}
                            className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-55 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2.5 flex items-center gap-3.5 text-[11px] font-bold text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1">📍 Expected Branches: <strong className="text-slate-900">{expectedBranches}</strong></span>
                        <span className="flex items-center gap-1">👥 Declared Employees: <strong className="text-slate-900">{declaredEmployees}</strong></span>
                        <button
                          onClick={() => {
                            setTempExpectedBranches(expectedBranches);
                            setTempDeclaredEmployees(declaredEmployees);
                            setIsEditingExpectations(true);
                          }}
                          className="text-emerald-600 hover:text-emerald-700 font-black uppercase tracking-wider text-[9.5px] cursor-pointer hover:underline flex items-center gap-0.5 ml-1"
                        >
                          ✏️ Edit Details
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {!isListEmpty && (
                    <div className={`self-start sm:self-center shrink-0 border rounded-2xl px-3.5 py-2 flex items-center gap-2 shadow-sm ${
                      isComplete 
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                        : "bg-amber-50 border-amber-200 text-amber-800"
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${isComplete ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
                      <span className="text-[10px] font-black uppercase tracking-wider">
                        {createdBranchesList.length} of {expectedBranches} Branch{expectedBranches > 1 ? "es" : ""} Configured
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Network Area */}
              <div className="p-5 sm:p-6 flex-1">
                {isListEmpty ? (
                  /* Empty state: No Skip Allowed */
                  <div className="py-4 text-center max-w-lg mx-auto flex flex-col items-center gap-3.5">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-slate-200/60 text-slate-700">
                      🏪
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-lg font-black text-slate-800 uppercase tracking-wide">
                        Initialize Your Enterprise Network
                      </h2>
                      <p className="text-slate-600 text-xs font-semibold leading-relaxed">
                        You registered your business with <span className="font-extrabold text-slate-900">{expectedBranches} location{expectedBranches > 1 ? "s" : ""}</span>. Branches are mandatory to scope products, forecast stock, and run sales operations. Please configure all branch details to proceed, or <button onClick={() => { setTempExpectedBranches(expectedBranches); setTempDeclaredEmployees(declaredEmployees); setIsEditingExpectations(true); }} className="text-slate-905 font-black underline hover:text-slate-700 cursor-pointer">edit business details</button>.
                      </p>
                    </div>

                    <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-left mt-1">
                      <div className="flex gap-2">
                        <span className="text-base leading-none">💡</span>
                        <div className="space-y-0.5">
                          <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-700">Setup Instructions</h4>
                          <p className="text-[10px] text-slate-600 font-semibold leading-relaxed">
                            Complete the 4-step wizard for each of your branches. If you log out or sign out at any point, your draft form values will remain completely safe.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center mt-2.5">
                      <button
                        onClick={() => {
                          setStep(1);
                          const assigned = createdBranchesList.reduce((acc, b) => acc + (Number(b.employee_count) || 0), 0);
                          setForm({
                            ...EMPTY_FORM,
                            employee_count: Math.max(0, declaredEmployees - expectedBranches - assigned)
                          });
                          setShowCreateForm(true);
                        }}
                        className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl transition-all duration-200 text-xs tracking-wider cursor-pointer shadow-md shadow-slate-950/10"
                      >
                        ➕ ADD YOUR FIRST BRANCH (1 of {expectedBranches})
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Hub branches table & Status banners */
                  <div className="space-y-6">
                    {/* Progress Alert Banners */}
                    {!isBranchCountComplete ? (
                      <div className="bg-amber-50 border border-amber-250 rounded-2xl p-4 flex items-start gap-3 text-amber-850 shadow-sm">
                        <span className="text-lg leading-none shrink-0">🏪</span>
                        <div className="space-y-0.5 text-left text-xs font-semibold leading-relaxed">
                          <h4 className="font-extrabold uppercase tracking-wider text-amber-900">Branch Configuration Incomplete</h4>
                          <p>
                            Progress: <span className="font-black text-amber-950">{createdBranchesList.length} of {expectedBranches}</span> branches registered. Please complete setting up the remaining <span className="font-black text-amber-950">{expectedBranches - createdBranchesList.length}</span> declared branch{expectedBranches - createdBranchesList.length > 1 ? "es" : ""} to launch your workspace, or <button onClick={() => { setTempExpectedBranches(expectedBranches); setTempDeclaredEmployees(declaredEmployees); setIsEditingExpectations(true); }} className="text-amber-950 font-black underline hover:text-amber-800 cursor-pointer">edit expectations</button>.
                          </p>
                        </div>
                      </div>
                    ) : !isEmployeeCountValid ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                        <span className="text-lg leading-none shrink-0">⚠️</span>
                        <div className="space-y-1 text-left text-xs font-semibold leading-relaxed">
                          <h4 className="font-extrabold uppercase tracking-wider text-amber-900">Employee Count Mismatch</h4>
                          <p className="text-amber-800">
                            During signup you said your business has <span className="font-black text-amber-950">{declaredEmployees} employee{declaredEmployees !== 1 ? "s" : ""}</span>. Since you have <span className="font-black text-amber-950">{createdBranchesList.length} branch{createdBranchesList.length !== 1 ? "es" : ""}</span> (each having 1 manager), the remaining staff across all branches should add up to <span className="font-black text-amber-950">{Math.max(0, declaredEmployees - createdBranchesList.length)}</span>, but currently adds up to <span className="font-black text-amber-950">{assignedEmployees}</span>.
                          </p>
                          <p className="text-amber-700 mt-1">
                            👉 Simply click <strong>Edit</strong> on any branch below and update its <strong>Employee Count</strong> field until the total matches <strong>{Math.max(0, declaredEmployees - createdBranchesList.length)}</strong>, or <button onClick={() => { setTempExpectedBranches(expectedBranches); setTempDeclaredEmployees(declaredEmployees); setIsEditingExpectations(true); }} className="text-amber-955 font-black underline hover:text-amber-850 cursor-pointer">edit business details</button>.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 text-emerald-800 shadow-sm">
                        <span className="text-lg leading-none shrink-0">✅</span>
                        <div className="space-y-0.5 text-left text-xs font-semibold leading-relaxed">
                          <h4 className="font-extrabold uppercase tracking-wider text-emerald-900">Network Fully Configured</h4>
                          <p>
                            Excellent! You have successfully registered all <span className="font-black text-emerald-955">{createdBranchesList.length}</span> branches (accounting for <span className="font-black text-emerald-955">{createdBranchesList.length}</span> managers) and allocated exactly <span className="font-black text-emerald-955">{assignedEmployees} of {Math.max(0, declaredEmployees - createdBranchesList.length)}</span> remaining employees. Your starter workspace dashboard is fully authorized and ready to launch.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* ── Mobile / Tablet: Card list ── */}
                    <div className="lg:hidden flex flex-col divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                      {/* Card header */}
                      <div className="bg-slate-950 px-4 py-2.5 flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Branch Identity</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Actions</span>
                      </div>

                      {createdBranchesList.map((b) => (
                        <div key={b.branch_id || b._id} className="bg-white px-4 py-4 space-y-3">
                          {/* Row 1: icon + name + code + status + actions */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-lg shadow-inner shrink-0">
                                {b.branch_type === "Warehouse" ? "🏭" : b.branch_type === "Franchise" ? "🤝" : b.branch_type === "Depot" ? "📦" : "🏪"}
                              </div>
                              <div className="min-w-0">
                                <div className="font-extrabold text-slate-900 text-sm leading-tight truncate">{b.branch_name}</div>
                                <span className="inline-flex items-center gap-1 rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-slate-600 mt-0.5">
                                  {b.branch_code || "CODE"}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[8px] font-black uppercase text-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Active
                              </span>
                            </div>
                          </div>

                          {/* Row 2: details grid */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 bg-slate-50/60 border border-slate-100 rounded-xl px-3 py-3 text-xs">
                            <div>
                              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Location</span>
                              <span className="font-bold text-slate-900 block">{b.city}</span>
                              <span className="text-slate-500 text-[10px] font-semibold">{b.state}, {b.country || "India"}</span>
                            </div>
                            <div>
                              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Manager</span>
                              <span className="font-bold text-slate-900 block">{b.manager_name}</span>
                              <span className="text-slate-500 text-[10px] font-semibold">{b.phone}</span>
                            </div>
                            <div>
                              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Team</span>
                              <span className="font-bold text-slate-900">{b.employee_count} Staff{b.employee_count !== 1 ? "" : " Member"}</span>
                            </div>
                            <div>
                              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Shift</span>
                              <span className="font-bold text-slate-900">{b.working_hours}</span>
                            </div>
                          </div>

                          {/* Row 3: actions */}
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => handleEditBranch(b)}
                              disabled={loading}
                              className="flex-1 py-2 text-center text-slate-700 font-black text-[10px] uppercase tracking-wider border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleDeleteBranch(b.branch_id || b._id)}
                              disabled={loading}
                              className="flex-1 py-2 text-center text-rose-600 font-black text-[10px] uppercase tracking-wider border border-rose-100 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* ── Desktop: Full table ── */}
                    <div className="hidden lg:block overflow-x-auto border border-slate-200/80 rounded-2xl shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-950 text-slate-100 border-b border-slate-800 text-[10px] font-black uppercase tracking-wider shadow-[inset_0_-1px_0_rgba(255,255,255,0.03)]">
                            <th className="px-5 py-3.5 text-slate-100">Branch Identity</th>
                            <th className="px-5 py-3.5 text-slate-100">Location</th>
                            <th className="px-5 py-3.5 text-slate-100">Manager &amp; Contact</th>
                            <th className="px-5 py-3.5 text-slate-100">Team &amp; Operations</th>
                            <th className="px-5 py-3.5 text-center text-slate-100">Status</th>
                            <th className="px-5 py-3.5 text-right text-slate-100">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-xs font-semibold text-slate-700">
                          {createdBranchesList.map((b) => (
                            <tr key={b.branch_id || b._id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-lg shadow-inner shrink-0">
                                    {b.branch_type === "Warehouse" ? "🏭" : b.branch_type === "Franchise" ? "🤝" : b.branch_type === "Depot" ? "📦" : "🏪"}
                                  </div>
                                  <div>
                                    <div className="font-extrabold text-slate-900 text-sm leading-tight mb-0.5">{b.branch_name}</div>
                                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider text-slate-600">
                                      {b.branch_code || "CODE"}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                <div className="text-slate-900 font-bold mb-0.5">{b.city}</div>
                                <div className="text-slate-500 text-[10px] font-bold">{b.state}, {b.country || "India"}</div>
                              </td>
                              <td className="px-5 py-4">
                                <div className="text-slate-900 font-bold mb-0.5">{b.manager_name}</div>
                                <div className="text-slate-500 text-[10px] font-bold">{b.phone}</div>
                              </td>
                              <td className="px-5 py-4">
                                <div className="text-slate-900 font-bold mb-0.5">{b.employee_count} Staff Member{b.employee_count !== 1 ? "s" : ""}</div>
                                <div className="text-slate-500 text-[10px] font-bold">Shift: {b.working_hours}</div>
                              </td>
                              <td className="px-5 py-4 text-center">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-emerald-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  ACTIVE
                                </span>
                              </td>
                              <td className="px-5 py-4 text-right">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    onClick={() => handleEditBranch(b)}
                                    disabled={loading}
                                    className="text-slate-700 hover:text-slate-900 transition-colors p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer select-none text-[10px] font-black uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Edit Branch"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteBranch(b.branch_id || b._id)}
                                    disabled={loading}
                                    className="text-rose-600 hover:text-rose-800 transition-colors p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer select-none text-[10px] font-black uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Delete Branch"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pt-4 border-t border-slate-100">
                      <button
                        onClick={() => {
                          const assigned = createdBranchesList.reduce((acc, b) => acc + (Number(b.employee_count) || 0), 0);
                          setForm({
                            ...EMPTY_FORM,
                            employee_count: Math.max(0, declaredEmployees - expectedBranches - assigned)
                          });
                          setShowCreateForm(true);
                        }}
                        disabled={isBranchCountComplete}
                        className={`w-full sm:w-auto px-6 py-3 border font-black rounded-xl transition-all duration-200 text-xs tracking-wider cursor-pointer shadow-sm ${
                          isBranchCountComplete
                            ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-50"
                            : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        ➕ REGISTER NEXT BRANCH ({isBranchCountComplete ? createdBranchesList.length : createdBranchesList.length + 1} of {expectedBranches})
                      </button>
                      <button
                        onClick={handleCompleteOnboarding}
                        disabled={!isComplete}
                        className={`w-full sm:w-auto px-8 py-3 font-black rounded-xl transition-all duration-200 text-xs tracking-widest cursor-pointer flex items-center justify-center gap-2 ${
                          isComplete
                            ? "bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-950/15"
                            : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                        }`}
                      >
                        🚀 COMPLETE ONBOARDING & LAUNCH →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Footer Note */}
            <p className="text-center text-slate-400 text-[10px] font-black uppercase tracking-wider mt-2">
              🔓 Initialize branches to activate inventory, sales triggers, and ML forecasting.
            </p>
          </div>
        </div>
      </div>
    );
  };

  if (!showCreateForm) {
    return renderOnboardingHub();
  }

  const STEPS = ["Branch", "Location", "Contact", "Review"];

  return (
    <div className="min-h-screen w-full bg-white flex flex-col pt-[56px] pb-4 px-4 sm:px-6 relative overflow-x-hidden">
      
      {/* ── Branded White Navbar (Clean, high-contrast, premium) ────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur-xl px-5 sm:px-8 py-2.5 flex justify-between items-center shadow-sm select-none">
        {/* Left Side: Brand Logo + Badge */}
        <div className="flex items-center gap-3">
          <span className="text-[14px] font-black uppercase tracking-[0.25em] text-slate-950">INVENTRA</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] text-slate-600">
            Setup Wizard
          </span>
        </div>

        {/* Center: Instruction Details */}
        <div className="hidden md:block text-slate-600 text-xs font-bold tracking-wide">
          ✨ Welcome, <span className="text-slate-900 font-extrabold">{storedUser.firstName || "Manager"}</span>! Complete setup to initialize operations.
        </div>

        {/* Right Side: Exit / Sign Out Button */}
        <button
          onClick={handleLogout}
          className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700 transition-all cursor-pointer select-none"
        >
          Sign Out
        </button>
      </header>

      {/* ── Main Setup Workspace Panel ── */}
      <div className="flex-1 w-full flex flex-col justify-center items-center mt-3.5">
        <div className="w-full max-w-[940px] flex flex-col px-1 sm:px-2">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 flex flex-col relative">
            {/* Step progress bar */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/60 rounded-t-3xl">
              <div className="flex items-start justify-between w-full max-w-[480px] mx-auto">
                {STEPS.map((label, i) => (
                  <React.Fragment key={label}>
                    <StepDot n={i + 1} current={step} label={label} />
                    {i < STEPS.length - 1 && <StepConnector done={step > i + 1} />}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Form Content Panel */}
            <div className="px-6 sm:px-8 py-5 flex-1">
              {/* ── Step 1: Branch Basics ── */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-1 text-slate-800">
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Branch Identity</h2>
                    <span className="text-[10px] font-bold text-slate-400">* Required fields</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                    <div className="md:col-span-5 flex flex-col gap-4">
                      <div>
                        <Label>{labels.nameLabel} <span className="text-rose-500 font-black">*</span></Label>
                        <input
                          type="text"
                          placeholder={labels.namePlaceholder}
                          value={form.branch_name}
                          onChange={(e) => {
                            set("branch_name", e.target.value);
                            if (!form.branch_code || form.branch_code === autoCode(form.branch_name)) {
                              set("branch_code", autoCode(e.target.value));
                            }
                          }}
                          className={inp("branch_name")}
                          autoFocus
                        />
                        <ErrMsg field="branch_name" />
                      </div>
                      <div>
                        <Label>{labels.codeLabel} <span className="text-rose-500 font-black">*</span></Label>
                        <input
                          type="text"
                          placeholder={labels.codePlaceholder}
                          value={form.branch_code}
                          onChange={(e) => set("branch_code", e.target.value.toUpperCase())}
                          className={inp("branch_code")}
                          maxLength={20}
                        />
                        <ErrMsg field="branch_code" />
                      </div>
                    </div>

                    <div className="md:col-span-7 flex flex-col justify-between">
                      <div>
                        <Label>Branch Type <span className="text-rose-500 font-black">*</span></Label>
                        <div className="grid grid-cols-2 gap-3 mt-1">
                          {BRANCH_TYPES.map((t) => {
                            const isSelected = form.branch_type === t.value;
                            return (
                              <button
                                key={t.value}
                                type="button"
                                onClick={() => set("branch_type", t.value)}
                                className={`p-2.5 rounded-2xl border-2 text-center transition-all duration-205 cursor-pointer flex flex-col items-center justify-center ${
                                  isSelected
                                    ? "border-slate-900 bg-slate-900 text-white shadow-md shadow-slate-950/10"
                                    : "border-slate-200 bg-slate-50 hover:border-slate-350 hover:bg-slate-100/50 text-slate-700"
                                }`}
                              >
                                <span className="text-xl mb-0.5 leading-none">{t.icon}</span>
                                <span className="text-[11px] font-black tracking-tight">{t.value}</span>
                                <span className={`text-[9px] font-semibold mt-0.5 leading-none ${isSelected ? "text-slate-300" : "text-slate-400"}`}>
                                  {t.desc}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 2: Location ── */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-1">
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Location Parameters</h2>
                    <span className="text-[10px] font-bold text-slate-400">* Required fields</span>
                  </div>

                  <div className="grid grid-cols-12 gap-4">
                    {/* Line 1: Address (Full width) */}
                    <div className="col-span-12">
                      <Label>{labels.addressLabel} <span className="text-rose-500 font-black">*</span></Label>
                      <input
                        type="text"
                        placeholder={labels.addressPlaceholder}
                        value={form.address}
                        onChange={(e) => set("address", e.target.value)}
                        className={inp("address")}
                      />
                      <ErrMsg field="address" />
                    </div>

                    {/* Line 2: City & State side-by-side */}
                    <div className="col-span-12 sm:col-span-6">
                      <Label>{labels.cityLabel} <span className="text-rose-500 font-black">*</span></Label>
                      <input
                        type="text"
                        placeholder={labels.cityPlaceholder}
                        value={form.city}
                        onChange={(e) => {
                          const val = e.target.value;
                          set("city", val);
                          const matchedState = getStateForCity(val);
                          if (matchedState) {
                            set("state", matchedState);
                          }
                        }}
                        className={inp("city")}
                      />
                      <ErrMsg field="city" />
                    </div>
                    <div className="col-span-12 sm:col-span-6 relative custom-dropdown-container">
                      <Label>State <span className="text-rose-500 font-black">*</span></Label>
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(!dropdownOpen);
                          setDropdownSearch("");
                        }}
                        className={`w-full border ${
                          errors.state ? "border-rose-400 bg-rose-50/40" : "border-slate-200 bg-slate-50/50"
                        } text-slate-900 px-4 py-2.5 rounded-xl font-bold text-sm outline-none text-left flex justify-between items-center transition-all cursor-pointer`}
                      >
                        <span className={form.state ? "text-slate-900 font-bold" : "text-slate-400 font-bold"}>
                          {form.state || "Select State"}
                        </span>
                        <svg className={`w-4 h-4 text-slate-500 transition-transform duration-205 ${dropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>
                      <ErrMsg field="state" />

                      {dropdownOpen && (
                        <div className="absolute left-0 right-0 z-50 mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-1.5 animate-fade-in flex flex-col gap-1.5">
                          <div className="px-1.5 py-1 sticky top-0 bg-white z-10 border-b border-slate-100">
                            <input
                              type="text"
                              placeholder="Search state..."
                              value={dropdownSearch}
                              onChange={(e) => setDropdownSearch(e.target.value)}
                              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-slate-400 bg-slate-50/80"
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                          </div>
                          <div className="overflow-y-auto max-h-40 space-y-0.5 animate-fade-in">
                            {filteredStates.length === 0 ? (
                              <div className="text-[11px] text-slate-400 font-bold py-2.5 text-center">No states found</div>
                            ) : (
                              filteredStates.map((s) => {
                                const isSelected = form.state === s;
                                return (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => {
                                      set("state", s);
                                      setDropdownOpen(false);
                                      setDropdownSearch("");
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex justify-between items-center ${
                                      isSelected
                                        ? "bg-slate-900 text-white"
                                        : "text-slate-700 hover:bg-slate-100"
                                    }`}
                                  >
                                    <span>{s}</span>
                                    {isSelected && <span className="text-emerald-450 font-black">✓</span>}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Line 3: Country & Pincode side-by-side */}
                    <div className="col-span-12 sm:col-span-6 relative custom-country-container">
                      <Label>Country <span className="text-rose-500 font-black">*</span></Label>
                      <button
                        type="button"
                        onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
                        className={`w-full border ${
                          errors.country ? "border-rose-400 bg-rose-50/40" : "border-slate-200 bg-slate-50/50"
                        } text-slate-900 px-4 py-2.5 rounded-xl font-bold text-sm outline-none text-left flex justify-between items-center transition-all cursor-pointer`}
                      >
                        <span className="text-slate-900 font-bold flex items-center gap-1.5">
                          <span>{COUNTRIES.find(c => c.name === form.country)?.flag || "🇮🇳"}</span>
                          <span>{form.country}</span>
                        </span>
                        <svg className={`w-4 h-4 text-slate-500 transition-transform duration-205 ${countryDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>
                      <ErrMsg field="country" />

                      {countryDropdownOpen && (
                        <div className="absolute left-0 right-0 z-50 mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-1.5 animate-fade-in flex flex-col gap-0.5">
                          {COUNTRIES.map((c) => {
                            const isSelected = form.country === c.name;
                            return (
                              <button
                                key={c.name}
                                type="button"
                                onClick={() => {
                                  set("country", c.name);
                                  set("phone_country_code", c.code);
                                  set("phone", c.code + " " + form.phone_number);
                                  setCountryDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex justify-between items-center ${
                                  isSelected ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span>{c.flag}</span>
                                  <span>{c.name}</span>
                                </span>
                                {isSelected && <span className="text-emerald-450 font-black">✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="col-span-12 sm:col-span-6">
                      <Label>{labels.pincodeLabel} <span className="text-rose-500 font-black">*</span></Label>
                      <input type="text" placeholder={labels.pincodePlaceholder} value={form.pincode} onChange={(e) => set("pincode", e.target.value)} className={inp("pincode")} maxLength={10} />
                      <ErrMsg field="pincode" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 3: Contact & Operations ── */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-1">
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Contact & Shifts</h2>
                    <span className="text-[10px] font-bold text-slate-400">* Required fields</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-6 flex flex-col gap-3.5">
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <Label>{labels.managerLabel} <span className="text-rose-500 font-black">*</span></Label>
                          <button
                            type="button"
                            onClick={() => {
                              set("manager_name", `${storedUser.firstName || ""} ${storedUser.lastName || ""}`.trim());
                              if (storedUser.phone) {
                                const phoneRaw = storedUser.phone;
                                let phone_country_code = "+91";
                                let phone_number = phoneRaw;
                                const m = phoneRaw.match(/^(\+\d+)\s*(.*)$/);
                                if (m) {
                                  phone_country_code = m[1];
                                  phone_number = m[2] || "";
                                }
                                set("phone_country_code", phone_country_code);
                                set("phone_number", phone_number);
                                set("phone", phoneRaw);
                              }
                              set("manager_email", storedUser.email || "");
                            }}
                            className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer select-none"
                          >
                            Assign Myself
                          </button>
                        </div>
                        <input type="text" placeholder={labels.placeholderName} value={form.manager_name} onChange={(e) => set("manager_name", e.target.value)} className={inp("manager_name")} />
                        <ErrMsg field="manager_name" />
                      </div>
                      <div>
                        <Label>Branch Manager Email (Optional)</Label>
                        <input type="email" placeholder="e.g. manager@yourbusiness.com" value={form.manager_email} onChange={(e) => set("manager_email", e.target.value)} className={inp("manager_email")} />
                        <ErrMsg field="manager_email" />
                      </div>
                      <div className="relative custom-phone-prefix-container">
                        <Label>{labels.phoneLabel} <span className="text-rose-500 font-black">*</span></Label>
                        <div className="flex relative">
                          <div className="absolute left-0 top-0 bottom-0 flex items-center z-10">
                            <button
                              type="button"
                              onClick={() => setPhonePrefixOpen(!phonePrefixOpen)}
                              className="h-full px-3 bg-slate-50 border-r border-slate-200 hover:bg-slate-100 rounded-l-xl text-slate-800 font-black text-xs flex items-center gap-1 transition-all cursor-pointer select-none"
                            >
                              <span>{COUNTRIES.find(c => c.code === form.phone_country_code)?.flag || "🇮🇳"}</span>
                              <span className="text-[11px] font-extrabold">{form.phone_country_code}</span>
                              <svg className={`w-2.5 h-2.5 text-slate-500 transition-transform ${phonePrefixOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                              </svg>
                            </button>

                            {phonePrefixOpen && (
                              <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-2xl p-1 z-50 animate-fade-in flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                                {COUNTRIES.map((c) => {
                                  const isSelected = form.phone_country_code === c.code;
                                  return (
                                    <button
                                      key={c.name}
                                      type="button"
                                      onClick={() => {
                                        set("phone_country_code", c.code);
                                        set("phone", c.code + " " + form.phone_number);
                                        setPhonePrefixOpen(false);
                                      }}
                                      className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex justify-between items-center ${
                                        isSelected ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                                      }`}
                                    >
                                      <span className="flex items-center gap-1.5">
                                        <span>{c.flag}</span>
                                        <span>{c.name} ({c.code})</span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <input
                            type="tel"
                            placeholder={labels.phonePlaceholder}
                            value={form.phone_number}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^\d\s\-]/g, ""); // allow digits, spaces, hyphens
                              set("phone_number", val);
                              set("phone", (form.phone_country_code + " " + val).trim());
                            }}
                            className={inp("phone_number") + " pl-[84px]"}
                          />
                        </div>
                        <ErrMsg field="phone" />
                      </div>
                      {form.branch_type !== "Warehouse" && (
                        <div>
                          <Label>{labels.gstLabel}</Label>
                          <input type="text" placeholder={labels.gstPlaceholder} value={form.gstin} onChange={(e) => set("gstin", e.target.value.toUpperCase())} className={inp("gstin") + " font-mono uppercase tracking-wider text-sm"} maxLength={15} />
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-6 flex flex-col gap-3.5">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>{labels.staffLabel}</Label>
                          <input type="number" min={0} value={form.employee_count} onChange={(e) => set("employee_count", e.target.value)} className={inp("employee_count")} />
                        </div>
                        <div>
                          <Label>{labels.openingDateLabel}</Label>
                          <input type="date" value={form.opening_date} onChange={(e) => set("opening_date", e.target.value)} className={inp("opening_date") + " cursor-pointer"} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <Label>{labels.hoursLabel}</Label>
                        </div>
                        <input type="text" placeholder={labels.placeholderHours} value={form.working_hours} onChange={(e) => set("working_hours", e.target.value)} className={inp("working_hours")} />
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {WORKING_HOURS_PRESETS.map((h) => {
                            const isSelected = form.working_hours === h;
                            return (
                              <button
                                key={h}
                                type="button"
                                onClick={() => set("working_hours", h)}
                                className={`px-2 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wide border transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                }`}
                              >
                                {h}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 4: Review ── */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-1">
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">{labels.verificationHeader}</h2>
                    <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Ready to launch</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-slate-950 rounded-2xl p-4 shadow-xl border border-slate-900 text-[13px] leading-tight">
                    <div className="space-y-3 md:border-r md:border-slate-800 md:pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg">
                          {BRANCH_TYPES.find((t) => t.value === form.branch_type)?.icon || "🏪"}
                        </div>
                        <div>
                          <h3 className="text-white font-black text-sm leading-none">{form.branch_name || `New ${labels.titleLabel}`}</h3>
                          <span className="text-emerald-400 text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block mt-1">{form.branch_code || "CODE"}</span>
                        </div>
                      </div>
                      <div className="pt-1">
                        <span className="text-slate-400 text-[9px] font-black uppercase tracking-wider block mb-1">{labels.addressSectionLabel}</span>
                        <span className="text-slate-200 text-xs font-semibold leading-relaxed block">{form.address}</span>
                        <span className="text-white text-xs font-bold block mt-1">{form.city}, {form.state}, {form.country} – {form.pincode}</span>
                      </div>
                    </div>

                    <div className="space-y-3 md:border-r md:border-slate-800 md:px-4">
                      <div>
                        <span className="text-slate-400 text-[9px] font-black uppercase tracking-wider block mb-1">{labels.managerSectionLabel}</span>
                        <span className="text-white text-sm font-bold block">{form.manager_name}</span>
                        <span className="text-slate-400 text-xs font-semibold block mt-0.5">{form.phone}</span>
                      </div>
                      {form.branch_type !== "Warehouse" && form.gstin && (
                        <div>
                          <span className="text-slate-400 text-[9px] font-black uppercase tracking-wider block mb-1">{labels.gstSectionLabel}</span>
                          <span className="text-emerald-400 font-mono text-[10px] font-black uppercase tracking-widest">{form.gstin}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 md:pl-4">
                      <div>
                        <span className="text-slate-400 text-[9px] font-black uppercase tracking-wider block mb-1">{labels.hoursSectionLabel}</span>
                        <span className="text-white text-sm font-bold block">{form.working_hours}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[9px] font-black uppercase tracking-wider block mb-1">{labels.teamSectionLabel}</span>
                        <span className="text-white text-xs font-bold block">{form.employee_count} Additional Staff Member{form.employee_count !== 1 ? "s" : ""}</span>
                        {form.opening_date && (
                          <span className="text-slate-400 text-[10px] font-semibold block mt-0.5">{labels.openingDateLabel}: {form.opening_date}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {errors.submit && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex flex-col gap-2 text-rose-600 text-xs font-bold leading-normal">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                        </svg>
                        <span>{errors.submit}</span>
                      </div>
                      {(errors.submit.toLowerCase().includes("token") || errors.submit.toLowerCase().includes("unauthorized") || errors.submit.toLowerCase().includes("expired")) && (
                        <button
                          type="button"
                          onClick={() => {
                            // Clear token & user data, but do NOT remove the BRANCH_DRAFT_KEY!
                            for (const storage of [localStorage, sessionStorage]) {
                              storage.removeItem("inventra_token");
                              storage.removeItem("inventra_user");
                            }
                            if (typeof window !== "undefined") {
                              window.history.replaceState({}, "", "/");
                              sessionStorage.removeItem("inventra_dashboard_section");
                            }
                            setActiveTab("home");
                          }}
                          className="mt-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider self-start transition-all cursor-pointer shadow-md shadow-rose-600/10"
                        >
                          Sign In Again (Keep Draft)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Navigation Controls ── */}
              <div className="flex items-center gap-3.5 mt-6 pt-5 border-t border-slate-100">
                {step === 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setStep(1);
                      setForm({
                        ...EMPTY_FORM,
                        employee_count: Math.max(1, declaredEmployees - 1)
                      });
                      setErrors({});
                    }}
                    className="px-5 py-2.5 border border-rose-200 bg-rose-55/40 hover:bg-rose-100 text-rose-700 font-extrabold rounded-xl transition-all text-xs tracking-wider cursor-pointer"
                  >
                    CANCEL
                  </button>
                )}
                {step > 1 && (
                  <button
                    type="button"
                    onClick={goBack}
                    className="px-5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-black rounded-xl transition-all text-xs tracking-wider cursor-pointer"
                  >
                    ← BACK
                  </button>
                )}
                {step < 4 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="ml-auto px-7 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl transition-all text-xs tracking-widest cursor-pointer shadow-lg shadow-slate-900/10"
                  >
                    CONTINUE →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="ml-auto px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black rounded-xl transition-all text-xs tracking-widest cursor-pointer shadow-lg shadow-emerald-600/20 flex items-center gap-1.5"
                  >
                    {loading ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        CREATING...
                      </>
                    ) : (
                      <>🚀 LAUNCH BRANCH</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Footer Note (Compact and clean) */}
          <p className="text-center text-slate-500 text-[10px] font-black uppercase tracking-wider mt-4">
            🔓 Complete branch setup to unlock full business intelligence access.
          </p>
        </div>
      </div>
    </div>
  );
}
