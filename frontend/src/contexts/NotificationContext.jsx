import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const NotificationContext = createContext(null);

const normalizeNotification = (notification) => ({
  id: String(notification?.id || notification?._id || notification?.key || crypto.randomUUID()),
  key: String(notification?.key || notification?.id || notification?._id || "notification"),
  type: String(notification?.type || "info"),
  title: String(notification?.title || ""),
  text: String(notification?.text || notification?.message || "").trim(),
  source: String(notification?.source || "system"),
  createdAt: notification?.createdAt || notification?.created_at || new Date().toISOString(),
  updatedAt: notification?.updatedAt || notification?.updated_at || null,
  isRead: Boolean(notification?.is_read ?? notification?.isRead ?? false),
  businessId: notification?.business_id || notification?.businessId || null,
  branchId: notification?.branch_id || notification?.branchId || null,
  meta: notification?.meta || null,
});

const getAuthToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("inventra_token") || sessionStorage.getItem("inventra_token");
};

const authHeaders = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [isReady, setIsReady] = useState(false);

  const fetchNotifications = async () => {
    const token = getAuthToken();
    if (!token) {
      setNotifications([]);
      setIsReady(true);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/notifications`, {
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch notifications (${response.status})`);
      }

      const data = await response.json();
      const normalized = Array.isArray(data) ? data.map(normalizeNotification) : [];
      setNotifications(normalized);
    } catch (error) {
      console.warn("Failed to load backend notifications:", error);
      setNotifications([]);
    } finally {
      setIsReady(true);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const interval = window.setInterval(() => {
      fetchNotifications();
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  const syncNotifications = async () => {
    await fetchNotifications();
  };

  const pushNotification = async (notification) => {
    const token = getAuthToken();
    if (!token) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/notifications/emit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(notification),
      });

      if (!response.ok) {
        throw new Error(`Failed to emit notification (${response.status})`);
      }

      const data = await response.json();
      await fetchNotifications();
      return data?.notification?.id || data?.notification?._id || null;
    } catch (error) {
      console.warn("Failed to emit backend notification:", error);
      return null;
    }
  };

  const dismissNotification = async (id) => {
    const token = getAuthToken();
    if (!token) {
      setNotifications((current) => current.filter((item) => item.id !== id));
      return;
    }

    try {
      await fetch(`${API_BASE_URL}/api/v1/notifications/mark-read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ ids: [id] }),
      });
    } catch (error) {
      console.warn("Failed to mark notification as read:", error);
    } finally {
      setNotifications((current) => current.filter((item) => item.id !== id));
    }
  };

  const clearNotifications = async () => {
    const token = getAuthToken();
    const ids = notifications.map((item) => item.id);

    if (!token) {
      setNotifications([]);
      return;
    }

    if (ids.length === 0) {
      return;
    }

    try {
      await fetch(`${API_BASE_URL}/api/v1/notifications/mark-read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ ids }),
      });
    } catch (error) {
      console.warn("Failed to clear notifications:", error);
    } finally {
      setNotifications([]);
    }
  };

  const value = useMemo(
    () => ({
      notifications,
      unreadCount: notifications.length,
      isReady,
      syncNotifications,
      pushNotification,
      dismissNotification,
      clearNotifications,
      refreshNotifications: fetchNotifications,
    }),
    [notifications, isReady]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}