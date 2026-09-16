// =============================================================================
// Campus Arena — Universal Auth & Persistence Layer
// Communicates with backend when available, falls back to persistent client DB
// =============================================================================

import type { User, StudentProfile } from "@shared/types";

export function getSessionHeaders(): Record<string, string> {
  const token = localStorage.getItem("ca_session_token");
  return token ? { "x-session-token": token } : {};
}

// ── Auth Service Client API ──

export async function apiRequestOtp(
  identifier: string,
  type: "email" | "mobile"
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch("/api/auth/otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, type }),
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      return await res.json();
    }
  } catch {
    // Network or server offline
  }

  return { success: false, message: "The secure verification service is unavailable. Please try again shortly." };
}

export async function apiRequestDualOtp(
  email: string,
  mobile: string
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch("/api/auth/dual-otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, mobile }),
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      return await res.json();
    }
  } catch {
    // Network or server offline
  }

  return { success: false, message: "The secure verification service is unavailable. Please try again shortly." };
}

export async function apiValidateOtp(identifier: string, code: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/otp/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, code }),
    });
    const data = await res.json();
    return res.ok ? data : { success: false, error: data.error || "Invalid verification code." };
  } catch {
    return { success: false, error: "The secure verification service is unavailable." };
  }
}

export async function apiVerifyOtp(
  identifier: string,
  code: string
): Promise<{ success: boolean; user?: User; sessionToken?: string; passwordSetupRequired?: boolean; passwordSetupToken?: string; error?: string }> {
  try {
    const res = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, code }),
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      return await res.json();
    }
  } catch {}
  return { success: false, error: "The secure authentication service is unavailable. Please try again shortly." };
}

export async function apiLoginWithPassword(identifier: string, password: string): Promise<{ success: boolean; user?: User; sessionToken?: string; error?: string }> {
  try {
    const res = await fetch("/api/auth/password/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }),
    });
    const data = await res.json();
    return res.ok ? data : { success: false, error: data.error || "Unable to sign in." };
  } catch { return { success: false, error: "The secure authentication service is unavailable. Please try again shortly." }; }
}

export async function apiSetupPassword(passwordSetupToken: string, password: string): Promise<{ success: boolean; user?: User; sessionToken?: string; error?: string }> {
  try {
    const res = await fetch("/api/auth/password/setup", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passwordSetupToken, password }),
    });
    const data = await res.json();
    return res.ok ? data : { success: false, error: data.error || "Unable to save password." };
  } catch { return { success: false, error: "The secure authentication service is unavailable. Please try again shortly." }; }
}

export async function apiVerifyDualOtp(params: {
  email: string;
  emailOtp: string;
  mobile: string;
  mobileOtp: string;
}): Promise<{ success: boolean; user?: User; sessionToken?: string; error?: string }> {
  try {
    const res = await fetch("/api/auth/dual-otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      return await res.json();
    }
  } catch {}
  return { success: false, error: "The secure authentication service is unavailable. Please try again shortly." };
}

export async function apiRegisterStudent(params: {
  name: string;
  rollNumber: string;
  email: string;
  emailOtp: string;
  mobile: string;
  mobileOtp: string;
  branch: string;
  year: string;
}): Promise<{ success: boolean; user?: User; sessionToken?: string; error?: string }> {
  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      return await res.json();
    }
  } catch {}
  return { success: false, error: "The secure authentication service is unavailable. Please try again shortly." };
}

export async function apiGetUser(userId: string): Promise<{ user?: User; error?: string }> {
  try {
    const res = await fetch(`/api/auth/me?userId=${userId}`);
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      return await res.json();
    }
  } catch {}
  return { error: "The secure authentication service is unavailable." };
}

export async function apiGetProfile(userId: string): Promise<{ profile?: StudentProfile; error?: string }> {
  try {
    const res = await fetch(`/api/profile/${userId}`);
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      return await res.json();
    }
  } catch {}
  return { error: "The secure authentication service is unavailable." };
}
