// =============================================================================
// Campus Arena — Global Authentication & Session Context
// =============================================================================

import React, { createContext, useContext, useEffect, useState } from "react";
import type { User, StudentProfile, PlatformRole, PlatformNotification } from "@shared/types";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  profile: StudentProfile | null;
  role: PlatformRole;
  notifications: PlatformNotification[];
  unreadCount: number;
  loading: boolean;
  loginWithOtp: (identifier: string, code: string) => Promise<{ success: boolean; error?: string }>;
  loginWithDualOtp: (params: { email: string; emailOtp: string; mobile: string; mobileOtp: string }) => Promise<{ success: boolean; error?: string }>;
  registerStudent: (data: any) => Promise<{ success: boolean; error?: string }>;
  recoverAccount: (data: any) => Promise<{ success: boolean; error?: string }>;
  switchRole: (role: PlatformRole) => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
  updateProfile: (updates: Partial<StudentProfile>) => Promise<boolean>;
  refreshUserData: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // When opening the website, check if a session exists; if not, stay logged out so Login page displays
  useEffect(() => {
    const savedUserId = localStorage.getItem("ca_user_id");
    if (savedUserId) {
      loadUser(savedUserId);
    } else {
      setLoading(false);
    }
  }, []);

  async function loadUser(userId: string) {
    try {
      setLoading(true);
      const res = await fetch(`/api/auth/me?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        localStorage.setItem("ca_user_id", data.user.id);

        // Load profile
        const profRes = await fetch(`/api/profile/${data.user.id}`);
        if (profRes.ok) {
          const pData = await profRes.json();
          setProfile(pData.profile);
        }

        // Load notifications
        const notifRes = await fetch(`/api/users/${data.user.id}/notifications`);
        if (notifRes.ok) {
          const nData = await notifRes.json();
          setNotifications(nData.notifications || []);
        }
      }
    } catch (err) {
      console.error("[AUTH] Error loading user data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loginWithOtp(identifier: string, code: string) {
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, code }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        localStorage.setItem("ca_user_id", data.user.id);
        await loadUser(data.user.id);
        toast.success(`Welcome back, ${data.user.name}!`);
        return { success: true };
      }
      return { success: false, error: data.error || "Authentication failed" };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async function loginWithDualOtp(params: {
    email: string;
    emailOtp: string;
    mobile: string;
    mobileOtp: string;
  }) {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/dual-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      setLoading(false);
      if (res.ok && data.user) {
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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        localStorage.setItem("ca_user_id", data.user.id);
        await loadUser(data.user.id);
        toast.success("Registration complete! Welcome to Campus Arena.");
        return { success: true };
      }
      return { success: false, error: data.error || "Registration failed" };
    } catch (err: any) {
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
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
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
      await fetch(`/api/users/${user.id}/notifications/read-all`, { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success("All notifications marked as read");
    } catch (err) {
      console.error(err);
    }
  }

  function logout() {
    localStorage.removeItem("ca_user_id");
    setUser(null);
    setProfile(null);
    setNotifications([]);
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
        loginWithDualOtp,
        registerStudent,
        recoverAccount,
        switchRole,
        switchUser,
        updateProfile,
        refreshUserData,
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
