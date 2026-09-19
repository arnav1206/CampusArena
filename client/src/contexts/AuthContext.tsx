// =============================================================================
// Campus Arena — Global Authentication & Session Context
// =============================================================================

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User, StudentProfile, PlatformRole, PlatformNotification } from "@shared/types";
import { toast } from "sonner";

import {
  apiGetUser,
  apiGetProfile,
  apiVerifyOtp,
  apiVerifyDualOtp,
  apiRegisterStudent,
  apiLoginWithPassword,
  apiSetupPassword,
  apiGetUserPreferences,
  apiUpdateUserPreferences,
  getSessionHeaders,
} from "@/lib/authClientDb";
import { useTheme } from "./ThemeContext";

type LoginResult = { success: boolean; error?: string; passwordSetupRequired?: boolean; passwordSetupToken?: string };

interface AuthContextType {
  user: User | null;
  profile: StudentProfile | null;
  role: PlatformRole;
  notifications: PlatformNotification[];
  unreadCount: number;
  loading: boolean;
  loginWithOtp: (identifier: string, code: string) => Promise<LoginResult>;
  loginWithPassword: (identifier: string, password: string) => Promise<LoginResult>;
  completePasswordSetup: (token: string, password: string) => Promise<LoginResult>;
  loginWithDualOtp: (params: { email: string; emailOtp: string; mobile: string; mobileOtp: string }) => Promise<{ success: boolean; error?: string }>;
  registerStudent: (data: any) => Promise<{ success: boolean; error?: string }>;
  recoverAccount: (data: any) => Promise<{ success: boolean; error?: string }>;
  switchRole: (role: PlatformRole) => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
  updateProfile: (updates: Partial<StudentProfile>) => Promise<boolean>;
  refreshUserData: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [preferencesLoadedFor, setPreferencesLoadedFor] = useState<string | null>(null);

  // When opening the website, check if a session exists; if not, stay logged out so Login page displays
  useEffect(() => {
    const savedUserId = localStorage.getItem("ca_user_id");
    if (savedUserId) {
      loadUser(savedUserId);
    } else {
      setLoading(false);
    }
  }, []);

  // Theme is a user preference, not just a browser preference. Wait until the
  // saved account settings have been applied before writing, so an old local
  // value can never overwrite the preference restored at sign-in.
  useEffect(() => {
    if (!user || preferencesLoadedFor !== user.id) return;
    void apiUpdateUserPreferences(user.id, { theme });
  }, [theme, user?.id, preferencesLoadedFor]);

  const loadNotifications = useCallback(async (userId: string) => {
    const response = await fetch(`/api/users/${userId}/notifications`, { headers: getSessionHeaders() });
    if (!response.ok) throw new Error("Unable to load notifications.");
    const data = await response.json();
    setNotifications(data.notifications || []);
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      await loadNotifications(user.id);
    } catch {
      // Keep the last successful list visible while a transient refresh fails.
    }
  }, [loadNotifications, user?.id]);

  // Polling keeps in-app notices current for recipients while they remain on a
  // dashboard. The API is the source of truth, so this also works after a reload.
  useEffect(() => {
    if (!user?.id) return;
    void refreshNotifications();
    const interval = window.setInterval(() => void refreshNotifications(), 10_000);
    return () => window.clearInterval(interval);
  }, [refreshNotifications, user?.id]);

  async function loadUser(userId: string) {
    try {
      setLoading(true);
      const userData = await apiGetUser(userId);
      if (userData.user) {
        setUser(userData.user);
        localStorage.setItem("ca_user_id", userData.user.id);

        // Load profile
        const profData = await apiGetProfile(userData.user.id);
        if (profData.profile) {
          setProfile(profData.profile);
        }

        // Restore settings for this account after every login/session restore.
        // localStorage remains only a short initial-display fallback.
        const savedPreferences = await apiGetUserPreferences(userData.user.id);
        if (savedPreferences.preferences?.theme === "light" || savedPreferences.preferences?.theme === "dark") {
          setTheme?.(savedPreferences.preferences.theme);
        }
        setPreferencesLoadedFor(userData.user.id);

        // Load notifications
        await loadNotifications(userData.user.id).catch(() => undefined);
      }
    } catch (err) {
      console.error("[AUTH] Error loading user data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loginWithOtp(identifier: string, code: string) {
    try {
      setLoading(true);
      const data = await apiVerifyOtp(identifier, code);
      setLoading(false);
      if (data.success && data.user) {
        if (data.passwordSetupRequired && data.passwordSetupToken) {
          return { success: true, passwordSetupRequired: true, passwordSetupToken: data.passwordSetupToken };
        }
        if (data.sessionToken) localStorage.setItem("ca_session_token", data.sessionToken);
        setUser(data.user);
        localStorage.setItem("ca_user_id", data.user.id);
        await loadUser(data.user.id);
        toast.success(`Welcome back, ${data.user.name}!`);
        return { success: true };
      }
      return { success: false, error: data.error || "Authentication failed" };
    } catch (err: any) {
      setLoading(false);
      return { success: false, error: err.message };
    }
  }

  async function loginWithPassword(identifier: string, password: string): Promise<LoginResult> {
    setLoading(true);
    const data = await apiLoginWithPassword(identifier, password);
    setLoading(false);
    if (!data.success || !data.user || !data.sessionToken) return { success: false, error: data.error || "Authentication failed" };
    localStorage.setItem("ca_session_token", data.sessionToken);
    setUser(data.user);
    localStorage.setItem("ca_user_id", data.user.id);
    await loadUser(data.user.id);
    toast.success(`Welcome back, ${data.user.name}!`);
    return { success: true };
  }

  async function completePasswordSetup(token: string, password: string): Promise<LoginResult> {
    setLoading(true);
    const data = await apiSetupPassword(token, password);
    setLoading(false);
    if (!data.success || !data.user || !data.sessionToken) return { success: false, error: data.error || "Unable to save password" };
    localStorage.setItem("ca_session_token", data.sessionToken);
    setUser(data.user);
    localStorage.setItem("ca_user_id", data.user.id);
    await loadUser(data.user.id);
    toast.success("Password created. You're all set!");
    return { success: true };
  }

  async function loginWithDualOtp(params: {
    email: string;
    emailOtp: string;
    mobile: string;
    mobileOtp: string;
  }) {
    try {
      setLoading(true);
      const data = await apiVerifyDualOtp(params);
      setLoading(false);
      if (data.success && data.user) {
        if (data.sessionToken) localStorage.setItem("ca_session_token", data.sessionToken);
        setUser(data.user);
        localStorage.setItem("ca_user_id", data.user.id);
        await loadUser(data.user.id);
        toast.success(`Identity verified! Welcome, ${data.user.name}.`);
        return { success: true };
      }
      return { success: false, error: data.error || "Dual factor verification failed" };
    } catch (err: any) {
      setLoading(false);
      return { success: false, error: err.message || "Network error" };
    }
  }

  async function registerStudent(params: any) {
    try {
      setLoading(true);
      const data = await apiRegisterStudent(params);
      setLoading(false);
      if (data.success && data.user) {
        if (data.sessionToken) localStorage.setItem("ca_session_token", data.sessionToken);
        setUser(data.user);
        localStorage.setItem("ca_user_id", data.user.id);
        await loadUser(data.user.id);
        toast.success("Registration complete! Welcome to Campus Arena.");
        return { success: true };
      }
      return { success: false, error: data.error || "Registration failed" };
    } catch (err: any) {
      setLoading(false);
      return { success: false, error: err.message };
    }
  }


  async function recoverAccount(params: any) {
    try {
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        if (data.sessionToken) localStorage.setItem("ca_session_token", data.sessionToken);
        setUser(data.user);
        localStorage.setItem("ca_user_id", data.user.id);
        await loadUser(data.user.id);
        toast.success("Account recovered successfully.");
        return { success: true };
      }
      return { success: false, error: data.error || "Account recovery failed" };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async function switchRole(newRole: PlatformRole) {
    if (!user) return;
    try {
      const res = await fetch("/api/auth/switch-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role: newRole }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        toast.info(`Switched role to: ${newRole.toUpperCase()}`);
      }
    } catch (err) {
      console.error("Failed to switch role:", err);
    }
  }

  async function switchUser(userId: string) {
    await loadUser(userId);
    toast.info("Switched user identity");
  }

  async function updateProfile(updates: Partial<StudentProfile>): Promise<boolean> {
    if (!user) return false;
    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, ...updates }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        toast.success("Profile saved successfully");
        return true;
      }
    } catch (err) {
      toast.error("Failed to save profile");
    }
    return false;
  }

  async function refreshUserData() {
    if (user) {
      await loadUser(user.id);
    }
  }

  async function markNotificationRead(id: string) {
    try {
      const response = await fetch(`/api/notifications/${id}/read`, { method: "POST", headers: getSessionHeaders() });
      if (!response.ok) throw new Error("Unable to mark notification as read.");
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  }

  async function markAllNotificationsRead() {
    if (!user) return;
    try {
      const response = await fetch(`/api/users/${user.id}/notifications/read-all`, { method: "POST", headers: getSessionHeaders() });
      if (!response.ok) throw new Error("Unable to mark notifications as read.");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success("All notifications marked as read");
    } catch (err) {
      console.error(err);
    }
  }

  function logout() {
    localStorage.removeItem("ca_user_id");
    localStorage.removeItem("ca_session_token");
    setUser(null);
    setProfile(null);
    setNotifications([]);
    setPreferencesLoadedFor(null);
    toast.info("Signed out successfully.");
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: user?.role || "student",
        notifications,
        unreadCount,
        loading,
        loginWithOtp,
        loginWithPassword,
        completePasswordSetup,
        loginWithDualOtp,
        registerStudent,
        recoverAccount,
        switchRole,
        switchUser,
        updateProfile,
        refreshUserData,
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
