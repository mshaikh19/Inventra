import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { getEmployees } from "../utils/employees";
import { getTasks, createTask, deleteTask, updateTask } from "../utils/tasks";
import { getUserBranches } from "../utils/branches";
import { getUserDisplayName, getDashboardTabFromUser, userHasOwnerAccess } from "../utils/dashboard";
import {
  getEmployeeRoleForBranchType,
  getTaskRoleOptions,
  getTaskTemplatesForBranch,
  isEmployeeUser,
} from "../utils/employeeWorkspace";
import CustomDropdown from "../components/CustomDropdown";

const Label = ({ children }) => (
  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
    {children}
  </label>
);

// Step indicator helper components
function StepDot({ n, current, label }) {
  const done = n < current;
  const active = n === current;
  return (
    <div className="flex flex-col items-center gap-1.5 w-24 flex-shrink-0 relative">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${done
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

export default function ManageTasks({ setActiveTab }) {
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
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Task Form & Modal States
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(() => {
    try {
      return sessionStorage.getItem("inventra_task_modal_open") === "true";
    } catch {
      return false;
    }
  });
  const [taskModalStep, setTaskModalStep] = useState(() => {
    try {
      const saved = sessionStorage.getItem("inventra_task_modal_step");
      return saved ? parseInt(saved, 10) : 1;
    } catch {
      return 1;
    }
  });
  const [taskModalErrors, setTaskModalErrors] = useState({});
  const [taskFormData, setTaskFormData] = useState(() => {
    try {
      const saved = sessionStorage.getItem("inventra_task_form_data");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      title: "",
      description: "",
      role: "employee",
      assigned_to: "",
      branch_id: "",
      priority: "medium"
    };
  });
  const [taskSubmitting, setTaskSubmitting] = useState(false);

  // Helper to clear task form draft from sessionStorage
  const clearTaskFormDraft = () => {
    try {
      sessionStorage.removeItem("inventra_task_modal_open");
      sessionStorage.removeItem("inventra_task_modal_step");
      sessionStorage.removeItem("inventra_task_form_data");
    } catch {}
  };

  // Sync Form States to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem("inventra_task_modal_open", isTaskModalOpen ? "true" : "false");
    } catch {}
  }, [isTaskModalOpen]);

  useEffect(() => {
    try {
      sessionStorage.setItem("inventra_task_modal_step", String(taskModalStep));
    } catch {}
  }, [taskModalStep]);

  useEffect(() => {
    try {
      sessionStorage.setItem("inventra_task_form_data", JSON.stringify(taskFormData));
    } catch {}
  }, [taskFormData]);

  // Filters State
  const [taskFilterPriority, setTaskFilterPriority] = useState("all");
  const [taskFilterStatus, setTaskFilterStatus] = useState("all");

  const userSession = React.useMemo(() => {
    if (typeof window === "undefined") return null;
    for (const storage of [localStorage, sessionStorage]) {
      const token = storage.getItem("inventra_token");
      const rawUser = storage.getItem("inventra_user");
      if (token && rawUser) {
        try {
          return { token, user: JSON.parse(rawUser) };
        } catch {
          return { token, user: null };
        }
      }
    }
    return null;
  }, []);

  const isOwner = userHasOwnerAccess(userSession?.user);
  const userDisplayName = getUserDisplayName(userSession?.user, "Administrator");

  useEffect(() => {
    fetchData();
  }, [userSession]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const empData = await getEmployees();
      const branchData = await getUserBranches();
      const taskData = await getTasks();

      let filtered = empData || [];
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
      setTasks(taskData || []);

      try {
        localStorage.setItem("inventra_employees_list", JSON.stringify(empData));
        if (branchData.branches) {
          localStorage.setItem("inventra_branches_list", JSON.stringify(branchData.branches));
        }
      } catch (e) {
        console.warn("Failed to update cache:", e);
      }
    } catch (err) {
      toast.error(err.message || "Failed to load tasks database");
    } finally {
      setLoading(false);
    }
  };

  const resolveDefaultTaskRole = (branchId) => {
    const branch = branches.find((b) => b.branch_id === branchId);
    return getEmployeeRoleForBranchType(branch?.branch_type || "Store");
  };

  const openTaskModal = () => {
    const defaultBranchId = isOwner ? "" : (userSession?.user?.branchId || "");
    setTaskFormData({
      title: "",
      description: "",
      role: defaultBranchId ? resolveDefaultTaskRole(defaultBranchId) : "employee",
      assigned_to: "",
      branch_id: defaultBranchId,
      priority: "medium",
    });
    setTaskModalStep(1);
    setTaskModalErrors({});
    setIsTaskModalOpen(true);
  };

  const validateTaskStep = (step) => {
    const errors = {};
    if (step === 1) {
      if (!taskFormData.title.trim()) {
        errors.title = "Task title is required.";
      }
      const finalBranchId = isOwner ? taskFormData.branch_id : (userSession?.user?.branchId || "");
      if (!finalBranchId) {
        errors.branch_id = "Branch location is required.";
      }
    }
    setTaskModalErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextTaskStep = () => {
    if (validateTaskStep(taskModalStep)) {
      setTaskModalStep(prev => prev + 1);
    }
  };

  const handlePrevTaskStep = () => {
    setTaskModalErrors({});
    setTaskModalStep(prev => prev - 1);
  };

  const applyTaskTemplate = (template) => {
    setTaskFormData((prev) => ({
      ...prev,
      title: template.title,
      description: template.description,
      priority: template.priority || "medium",
    }));
  };

  const handleToggleTaskStatus = async (taskId, currentStatus) => {
    const nextStatus = currentStatus === "completed" ? "pending" : "completed";
    const backupTasks = [...tasks];
    setTasks((prev) =>
      prev.map((t) => {
        const id = t._id || t.id;
        if (id === taskId) {
          return { ...t, status: nextStatus, completed_at: nextStatus === "completed" ? new Date().toISOString() : null };
        }
        return t;
      })
    );
    try {
      await updateTask(taskId, { status: nextStatus });
      toast.success(nextStatus === "completed" ? "Task marked complete" : "Task reopened");
    } catch (err) {
      setTasks(backupTasks);
      toast.error(err.message || "Failed to update task");
    }
  };

  const handleCreateTask = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!validateTaskStep(1) || !validateTaskStep(2)) {
      return;
    }
    const finalBranchId = isOwner ? taskFormData.branch_id : (userSession?.user?.branchId || "");

    setTaskSubmitting(true);
    try {
      const payload = {
        title: taskFormData.title.trim(),
        description: taskFormData.description.trim() || undefined,
        role: taskFormData.role,
        assigned_to: taskFormData.assigned_to || undefined,
        branch_id: finalBranchId,
        priority: taskFormData.priority
      };
      await createTask(payload);
      toast.success("Task assigned successfully!");
      clearTaskFormDraft();
      setIsTaskModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || "Failed to assign task");
    } finally {
      setTaskSubmitting(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    const backupTasks = [...tasks];
    setTasks(prev => prev.filter(t => t._id !== taskId && t.id !== taskId));
    try {
      await deleteTask(taskId);
      toast.success("Task deleted successfully");
      fetchData();
    } catch (err) {
      setTasks(backupTasks);
      toast.error(err.message || "Failed to delete task");
    }
  };

  const filteredAssignees = React.useMemo(() => {
    const targetBranchId = isOwner ? taskFormData.branch_id : (userSession?.user?.branchId || "");
    if (!targetBranchId) return [];
    return employees.filter(emp => emp.branchId === targetBranchId && emp.role !== "owner");
  }, [employees, taskFormData.branch_id, isOwner, userSession]);

  const filteredTasks = React.useMemo(() => {
    return tasks.filter((task) => {
      const matchesPriority = taskFilterPriority === "all" || task.priority === taskFilterPriority;
      const matchesStatus = taskFilterStatus === "all" || task.status === taskFilterStatus;
      return matchesPriority && matchesStatus;
    });
  }, [tasks, taskFilterPriority, taskFilterStatus]);

  const getBranchName = (branchId) => {
    const branch = branches.find(b => b.branch_id === branchId);
    return branch ? branch.branch_name : "General / All";
  };

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
      const prefix = roleStr.split("_")[0];
      return prefix.charAt(0).toUpperCase() + prefix.slice(1) + " Staff";
    }
    return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  if (userSession?.user && isEmployeeUser(userSession.user)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F6FAF8] text-slate-950 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-emerald-100 bg-white/95 backdrop-blur-xl shadow-sm">
        <div className="flex items-center justify-between gap-4 px-4 sm:px-6 md:px-12 py-3.5">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              onClick={() => setActiveTab(getDashboardTabFromUser(userSession?.user))}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-950 transition-colors shrink-0"
              aria-label="Back to Dashboard"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-[0.18em] hidden sm:inline">Dashboard</span>
            </button>
            <div className="hidden sm:block w-px h-7 bg-slate-200 shrink-0" />
            <div className="min-w-0">
              <span className="text-[8px] font-black uppercase tracking-[0.22em] text-emerald-700 hidden md:block leading-none mb-1">Enterprise Resources</span>
              <h3 className="text-sm md:text-lg font-black leading-tight truncate">Tasks & Operations Delegation</h3>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden md:inline text-[10px] font-bold text-slate-400 uppercase tracking-widest">{userDisplayName}</span>
            <button
              onClick={openTaskModal}
              className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 transition-all hover:scale-[1.02] flex items-center gap-1.5 shadow-md shadow-emerald-100"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Assign Task
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 md:px-12 py-6 max-w-7xl mx-auto space-y-6">
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        ) : (
          <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-6 text-left">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎯</span>
                <div>
                  <h4 className="text-base font-black text-slate-900">Task Management Board</h4>
                  <p className="text-xs text-slate-500 font-semibold">Assign and track duties across your branch locations.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:flex md:items-center gap-3 w-full md:w-auto">
                {/* Filter by Priority */}
                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-1.5 min-w-0 w-full md:w-auto">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Priority</span>
                  <CustomDropdown
                    value={taskFilterPriority}
                    onChange={setTaskFilterPriority}
                    options={[
                      { value: "all", label: "All Priorities" },
                      { value: "high", label: "🔴 High" },
                      { value: "medium", label: "🟡 Medium" },
                      { value: "low", label: "🔵 Low" },
                    ]}
                    theme="emerald"
                    size="sm"
                    buttonClassName="font-bold w-full"
                    className="w-full min-w-0 md:min-w-[130px]"
                  />
                </div>

                {/* Filter by Status */}
                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-1.5 min-w-0 w-full md:w-auto">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Status</span>
                  <CustomDropdown
                    value={taskFilterStatus}
                    onChange={setTaskFilterStatus}
                    options={[
                      { value: "all", label: "All Statuses" },
                      { value: "pending", label: "⏳ Pending" },
                      { value: "completed", label: "✅ Completed" },
                    ]}
                    theme="emerald"
                    size="sm"
                    buttonClassName="font-bold w-full"
                    className="w-full min-w-0 md:min-w-[130px]"
                  />
                </div>
              </div>
            </div>

            {/* Tasks Grid */}
            {filteredTasks.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/30 p-12 text-center w-full">
                <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-slate-200">
                    🎯
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-lg font-black text-slate-800 tracking-tight">No Tasks Found</h4>
                    <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                      {tasks.length === 0
                        ? "You haven't assigned any tasks yet. Click 'Assign Task' above to delegate tasks to your staff."
                        : "No tasks match your active priority and status filters."}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTasks.map((task) => {
                  const assignee = employees.find(e => e._id === task.assigned_to || e.id === task.assigned_to);
                  const isCompleted = task.status === "completed";
                  const priorityColor =
                    task.priority === "high"
                      ? "bg-rose-50 border-rose-200 text-rose-700"
                      : task.priority === "medium"
                      ? "bg-amber-50 border-amber-200 text-amber-700"
                      : "bg-blue-50 border-blue-200 text-blue-700";

                  return (
                    <div
                      key={task._id || task.id}
                      className={`rounded-2xl border p-5 transition-all duration-300 flex flex-col justify-between shadow-sm relative overflow-hidden bg-white ${
                        isCompleted ? "border-slate-100 opacity-75" : "border-slate-200 hover:shadow-md hover:border-slate-300"
                      }`}
                    >
                      {!isCompleted && task.priority === "high" && (
                        <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
                      )}

                      <div>
                        <div className="flex justify-between items-start gap-4">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider border ${priorityColor}`}>
                            {task.priority} Priority
                          </span>
                          <button
                            onClick={() => handleDeleteTask(task._id || task.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer border-0 bg-transparent"
                            title="Delete task"
                          >
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        </div>

                        <div className="mt-3.5">
                          <h4 className={`text-sm font-black text-slate-900 leading-tight text-left ${isCompleted ? "line-through text-slate-400" : ""}`}>
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className={`text-xs font-semibold text-slate-500 mt-1.5 leading-relaxed text-left ${isCompleted ? "text-slate-400/80" : ""}`}>
                              {task.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 pt-3.5 border-t border-slate-100 flex flex-col gap-2 text-[10px] font-bold text-slate-400">
                        <div className="flex justify-between items-center">
                          <span>📍 {getBranchName(task.branch_id)}</span>
                          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider ${
                            isCompleted ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700 animate-pulse"
                          }`}>
                            {isCompleted ? "✓ Completed" : "⏳ Pending"}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-slate-500 font-semibold">
                          <span>Assignee: <span className="font-bold text-slate-800">{assignee ? `${assignee.firstName} ${assignee.lastName}` : `Role: ${getRoleLabel(task.role)}`}</span></span>
                          <span>{task.created_at ? new Date(task.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleTaskStatus(task._id || task.id, task.status)}
                          className={`mt-1 w-full rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                            isCompleted
                              ? "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                        >
                          {isCompleted ? "↩ Reopen Task" : "✓ Mark Complete"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Task Modal Dialog */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)] flex flex-col relative">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-600 rounded-t-3xl shrink-0" />

            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 bg-slate-50/40 text-left shrink-0 rounded-t-3xl">
              <span className="text-[9px] font-black uppercase tracking-[0.24em] text-emerald-700">Task Assignment</span>
              <h3 className="text-lg font-black text-slate-950 mt-1">Assign Operational Task</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">Directly delegate task objectives to branch employees or specific roles.</p>
            </div>

            {/* Progress Steps Indicator */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/60 shrink-0">
              <div className="flex items-start justify-between w-full max-w-[480px] mx-auto">
                <StepDot n={1} current={taskModalStep} label="Task Details" />
                <StepConnector done={taskModalStep > 1} />
                <StepDot n={2} current={taskModalStep} label="Assignment" />
                <StepConnector done={taskModalStep > 2} />
                <StepDot n={3} current={taskModalStep} label="Priority & Review" />
              </div>
            </div>

            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex flex-col flex-1"
            >
              {/* Form Content */}
              <div className="p-6 space-y-4 text-left flex-1">
                {/* Step 1: Task Location & Details */}
                {taskModalStep === 1 && (
                  <div className="space-y-4">
                    {/* Branch select for Owners */}
                    {isOwner ? (
                      <div>
                        <Label>Assign to Branch Location <span className="text-rose-500">*</span></Label>
                        <CustomDropdown
                          value={taskFormData.branch_id}
                          onChange={(val) => setTaskFormData(prev => ({
                            ...prev,
                            branch_id: val,
                            assigned_to: "",
                            role: val ? resolveDefaultTaskRole(val) : "employee",
                          }))}
                          options={[
                            { value: "", label: "Select Branch" },
                            ...branches.map(b => ({ value: b.branch_id, label: `${b.branch_name} (${b.branch_type})` }))
                          ]}
                          theme="emerald"
                          className="w-full"
                          buttonClassName="font-bold"
                        />
                        {taskModalErrors.branch_id && (
                          <p className="text-rose-600 text-xs font-bold mt-1.5 leading-none">{taskModalErrors.branch_id}</p>
                        )}
                      </div>
                    ) : null}

                    {/* Quick templates (task recommendations) */}
                    {(() => {
                      const branchId = isOwner ? taskFormData.branch_id : (userSession?.user?.branchId || "");
                      if (!branchId) {
                        return (
                          <div>
                            <Label>Task Recommendations</Label>
                            <p className="text-[10px] font-bold text-slate-400">
                              Select a branch location to view recommended task templates.
                            </p>
                          </div>
                        );
                      }
                      const branch = branches.find((b) => b.branch_id === branchId);
                      const templates = getTaskTemplatesForBranch(branch?.branch_type);
                      if (!templates.length) return null;
                      return (
                        <div>
                          <Label>Recommended Tasks ({branch?.branch_type || "Store"})</Label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {templates.slice(0, 4).map((tpl) => (
                              <button
                                key={tpl.title}
                                type="button"
                                onClick={() => applyTaskTemplate(tpl)}
                                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 transition-all cursor-pointer"
                              >
                                {tpl.title}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Title */}
                    <div>
                      <Label>Task Title <span className="text-rose-500">*</span></Label>
                      <input
                        type="text"
                        placeholder="e.g. Restock front shelves"
                        value={taskFormData.title}
                        onChange={(e) => setTaskFormData(prev => ({ ...prev, title: e.target.value }))}
                        className={`w-full border px-4 py-2.5 rounded-xl font-bold text-sm outline-none transition-all ${
                          taskModalErrors.title
                            ? "border-rose-500 bg-rose-50/40 focus:ring-4 focus:ring-rose-900/5 focus:border-rose-500"
                            : "border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:ring-4 focus:ring-slate-900/5 focus:border-emerald-500 focus:bg-white"
                        }`}
                        required
                      />
                      {taskModalErrors.title && (
                        <p className="text-rose-600 text-xs font-bold mt-1.5 leading-none">{taskModalErrors.title}</p>
                      )}
                    </div>

                    {/* Description */}
                    <div>
                      <Label>Description / Instructions</Label>
                      <textarea
                        placeholder="Provide instructions or checklist..."
                        value={taskFormData.description}
                        onChange={(e) => setTaskFormData(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 px-4 py-2.5 rounded-xl font-bold text-sm outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-emerald-500 focus:bg-white transition-all h-20 resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* Step 2: Assignment Scoping */}
                {taskModalStep === 2 && (
                  <div className="space-y-4">
                    {/* Grid: Role & Assignee */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Target Role */}
                      <div>
                        <Label>Target Staff Role</Label>
                        <CustomDropdown
                          value={taskFormData.role}
                          onChange={(val) => setTaskFormData(prev => ({ ...prev, role: val }))}
                          options={(() => {
                            const branchId = isOwner ? taskFormData.branch_id : (userSession?.user?.branchId || "");
                            const branch = branches.find((b) => b.branch_id === branchId);
                            return getTaskRoleOptions(branch?.branch_type, { includeManagers: isOwner });
                          })()}
                          theme="emerald"
                          className="w-full"
                          buttonClassName="font-bold"
                        />
                      </div>

                      {/* Specific Assignee */}
                      <div>
                        <Label>Specific Employee Assignee</Label>
                        <CustomDropdown
                          value={taskFormData.assigned_to}
                          onChange={(val) => setTaskFormData(prev => ({ ...prev, assigned_to: val }))}
                          options={[
                            { value: "", label: taskFormData.branch_id || !isOwner ? "All (Matching Role)" : "Select branch first" },
                            ...filteredAssignees.map(emp => ({ value: emp._id || emp.id, label: `${emp.firstName} ${emp.lastName}` }))
                          ]}
                          theme="emerald"
                          className="w-full"
                          buttonClassName="font-bold"
                          disabled={isOwner && !taskFormData.branch_id}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Priority & Review */}
                {taskModalStep === 3 && (
                  <div className="space-y-4">
                    {/* Priority */}
                    <div>
                      <Label>Priority Level</Label>
                      <div className="flex gap-3 mt-1.5">
                        {[
                          { value: "low", label: "🔵 Low", desc: "Routine tasks" },
                          { value: "medium", label: "🟡 Medium", desc: "Standard shift duties" },
                          { value: "high", label: "🔴 High", desc: "Immediate attention" }
                        ].map((p) => {
                          const isSelected = taskFormData.priority === p.value;
                          return (
                            <button
                              key={p.value}
                              type="button"
                              onClick={() => setTaskFormData(prev => ({ ...prev, priority: p.value }))}
                              className={`flex-1 p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${isSelected
                                ? "border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm"
                                : "border-slate-200 bg-slate-50 hover:border-slate-300 text-slate-700"
                              }`}
                            >
                              <span className="text-xs font-black block">{p.label}</span>
                              <span className="text-[9px] font-semibold text-slate-400 block mt-0.5">{p.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Review Card */}
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 space-y-3">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200/60 pb-1.5">
                        Operational Scoping Summary
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="block font-semibold text-slate-400">Task Title</span>
                          <span className="block font-black text-slate-800 mt-0.5 truncate">{taskFormData.title}</span>
                        </div>
                        <div>
                          <span className="block font-semibold text-slate-400">Priority Level</span>
                          <span className="block font-black text-slate-800 mt-0.5 uppercase tracking-wider">
                            {taskFormData.priority === "high" ? "🔴 High" : taskFormData.priority === "medium" ? "🟡 Medium" : "🔵 Low"}
                          </span>
                        </div>
                        <div>
                          <span className="block font-semibold text-slate-400">Target Role / Staff</span>
                          <span className="block font-black text-slate-800 mt-0.5 truncate">
                            {(() => {
                              const assignee = employees.find(e => e._id === taskFormData.assigned_to || e.id === taskFormData.assigned_to);
                              return assignee ? `${assignee.firstName} ${assignee.lastName}` : `Role: ${getRoleLabel(taskFormData.role)}`;
                            })()}
                          </span>
                        </div>
                        <div>
                          <span className="block font-semibold text-slate-400">Branch Location</span>
                          <span className="block font-black text-slate-800 mt-0.5 truncate">
                            {getBranchName(isOwner ? taskFormData.branch_id : (userSession?.user?.branchId || ""))}
                          </span>
                        </div>
                      </div>
                      {taskFormData.description && (
                        <div className="text-xs pt-1.5 border-t border-slate-200/40">
                          <span className="block font-semibold text-slate-400">Description / Instructions</span>
                          <p className="font-bold text-slate-600 mt-0.5 leading-relaxed truncate">{taskFormData.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Buttons */}
              <div className="p-6 border-t border-slate-100 bg-slate-50/40 flex justify-between gap-3 shrink-0 rounded-b-3xl">
                <button
                  type="button"
                  onClick={taskModalStep === 1 ? () => {
                    clearTaskFormDraft();
                    setIsTaskModalOpen(false);
                  } : handlePrevTaskStep}
                  className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-slate-500 transition-all cursor-pointer"
                >
                  {taskModalStep === 1 ? "Cancel" : "Back"}
                </button>
                
                {taskModalStep < 3 ? (
                  <button
                    type="button"
                    onClick={handleNextTaskStep}
                    className="rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-md cursor-pointer"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateTask}
                    disabled={taskSubmitting}
                    className="rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-md cursor-pointer disabled:opacity-60"
                  >
                    {taskSubmitting ? "Assigning..." : "Assign Task"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
