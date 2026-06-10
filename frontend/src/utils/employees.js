const API_BASE = "http://127.0.0.1:8000/api/v1/employees";

export function getAuthHeaders() {
  const token = localStorage.getItem("inventra_token") || sessionStorage.getItem("inventra_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Fetch all employees for the current business */
export async function getEmployees() {
  const res = await fetch(API_BASE + "/", {
    method: "GET",
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Failed to fetch staff members");
  }
  return data;
}

/** Add a new manager or employee */
export async function createEmployee(employeeData) {
  const res = await fetch(API_BASE + "/", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(employeeData),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data.detail && typeof data.detail === "object"
        ? data.detail.message
        : data.detail) || "Failed to add staff member";
    throw new Error(msg);
  }
  return data;
}

/** Update employee details */
export async function updateEmployee(employeeId, updates) {
  const res = await fetch(`${API_BASE}/${employeeId}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data.detail && typeof data.detail === "object"
        ? data.detail.message
        : data.detail) || "Failed to update staff member";
    throw new Error(msg);
  }
  return data;
}

/** Deactivate (soft-delete) an employee */
export async function deactivateEmployee(employeeId) {
  const res = await fetch(`${API_BASE}/${employeeId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Failed to deactivate staff member");
  }
  return data;
}
