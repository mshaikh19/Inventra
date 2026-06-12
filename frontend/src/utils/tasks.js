const API_BASE = "http://127.0.0.1:8000/api/v1/tasks";

export function getAuthHeaders() {
  const token = localStorage.getItem("inventra_token") || sessionStorage.getItem("inventra_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Fetch all tasks scoped for the current user */
export async function getTasks() {
  const res = await fetch(API_BASE + "/", {
    method: "GET",
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Failed to fetch tasks");
  }
  return data;
}

/** Create a new task */
export async function createTask(taskData) {
  const res = await fetch(API_BASE + "/", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(taskData),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Failed to create task");
  }
  return data;
}

/** Update/complete a task */
export async function updateTask(taskId, updates) {
  const res = await fetch(`${API_BASE}/${taskId}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Failed to update task");
  }
  return data;
}

/** Delete a task */
export async function deleteTask(taskId) {
  const res = await fetch(`${API_BASE}/${taskId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Failed to delete task");
  }
  return data;
}
