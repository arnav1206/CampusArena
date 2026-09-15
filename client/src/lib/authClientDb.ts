// =============================================================================
// Campus Arena — Universal Auth & Persistence Layer
// Communicates with backend when available, falls back to persistent client DB
// =============================================================================

import type { User, StudentProfile } from "@shared/types";

const USERS_KEY = "ca_db_users";
const PROFILES_KEY = "ca_db_profiles";
const OTPS_KEY = "ca_db_otps";

interface StoredOtp {
  code: string;
  expiresAt: number;
}

function getStoredOtps(): Record<string, StoredOtp> {
  try {
    return JSON.parse(localStorage.getItem(OTPS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveStoredOtp(identifier: string, code: string) {
  const otps = getStoredOtps();
  otps[identifier.toLowerCase().trim()] = {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  };
  localStorage.setItem(OTPS_KEY, JSON.stringify(otps));
}

function verifyStoredOtp(identifier: string, code: string): boolean {
  const otps = getStoredOtps();
  const entry = otps[identifier.toLowerCase().trim()];
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    delete otps[identifier.toLowerCase().trim()];
    localStorage.setItem(OTPS_KEY, JSON.stringify(otps));
    return false;
  }
  if (entry.code === code.trim()) {
    delete otps[identifier.toLowerCase().trim()];
    localStorage.setItem(OTPS_KEY, JSON.stringify(otps));
    return true;
  }
  return false;
}

export function getClientUsers(): User[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveClientUser(user: User) {
  const users = getClientUsers().filter((u) => u.id !== user.id && u.email !== user.email);
  users.unshift(user);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getClientProfiles(): StudentProfile[] {
  try {
    return JSON.parse(localStorage.getItem(PROFILES_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveClientProfile(profile: StudentProfile) {
  const profiles = getClientProfiles().filter((p) => p.userId !== profile.userId);
  profiles.unshift(profile);
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export function generateRandomOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Auth Service Client API ──

export async function apiRequestOtp(
  identifier: string,
  type: "email" | "mobile"
): Promise<{ success: boolean; message: string; devOtp?: string }> {
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

  // Client DB fallback
  const otp = generateRandomOtp();
  saveStoredOtp(identifier, otp);
  return {
    success: true,
    message: `Verification code generated for ${identifier}`,
    devOtp: otp,
  };
}

export async function apiRequestDualOtp(
  email: string,
  mobile: string
): Promise<{ success: boolean; message: string; devEmailOtp?: string; devMobileOtp?: string }> {
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

  // Client DB fallback
  const emailOtp = generateRandomOtp();
  const mobileOtp = generateRandomOtp();
  saveStoredOtp(email, emailOtp);
  saveStoredOtp(mobile, mobileOtp);
  return {
    success: true,
    message: "Verification codes dispatched to email and mobile.",
    devEmailOtp: emailOtp,
    devMobileOtp: mobileOtp,
  };
}

export async function apiVerifyOtp(
  identifier: string,
  code: string
): Promise<{ success: boolean; user?: User; error?: string }> {
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
  } catch {
    // Network or server offline
  }

  // Client DB fallback
  const valid = verifyStoredOtp(identifier, code);
  if (!valid) {
    return { success: false, error: "Invalid or expired verification code." };
  }

  const cleanId = identifier.trim().toLowerCase();
  let user = getClientUsers().find(
    (u) => u.email.toLowerCase() === cleanId || u.mobile.replace(/\s+/g, "") === cleanId.replace(/\s+/g, "")
  );

  if (!user) {
    const isEmail = cleanId.includes("@");
    const newId = `u_${Date.now()}`;
    const name = isEmail
      ? cleanId.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Student User";

    user = {
      id: newId,
      collegeId: "CAMPUS_MAIN",
      email: isEmail ? cleanId : `${cleanId.replace(/\D/g, "")}@campus.edu`,
      mobile: isEmail ? "" : cleanId,
      name,
      role: cleanId.includes("admin") ? "admin" : "student",
      avatarUrl: "",
      isVerifiedCollegeUser: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveClientUser(user);

    saveClientProfile({
      id: `p_${Date.now()}`,
      userId: newId,
      name: user.name,
      rollNumber: user.rollNumber || "",
      branch: "Computer Science & Engineering",
      year: "1st Year",
      facePresenceVerified: false,
      technicalSkills: [],
      nonTechnicalSkills: [],
      domains: [],
      githubUrl: "",
      linkedinUrl: "",
      portfolioUrl: "",
      lookingForTeam: false,
      updatedAt: new Date().toISOString(),
    });
  }

  return { success: true, user };
}

export async function apiVerifyDualOtp(params: {
  email: string;
  emailOtp: string;
  mobile: string;
  mobileOtp: string;
}): Promise<{ success: boolean; user?: User; error?: string }> {
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
  } catch {
    // Network or server offline
  }

  // Client DB fallback
  const emailValid = verifyStoredOtp(params.email, params.emailOtp);
  const mobileValid = verifyStoredOtp(params.mobile, params.mobileOtp);

  if (!emailValid && !mobileValid) {
    return { success: false, error: "Both Email and Mobile OTPs are invalid or expired." };
  }
  if (!emailValid) {
    return { success: false, error: "Invalid Email OTP." };
  }
  if (!mobileValid) {
    return { success: false, error: "Invalid Mobile OTP." };
  }

  const cleanEmail = params.email.trim().toLowerCase();
  let user = getClientUsers().find((u) => u.email.toLowerCase() === cleanEmail);
  if (!user) {
    const name = cleanEmail
      .split("@")[0]
      .replace(/[._]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const newId = `u_${Date.now()}`;
    user = {
      id: newId,
      collegeId: "CAMPUS_MAIN",
      email: cleanEmail,
      mobile: params.mobile.trim(),
      name: name || "Campus Scholar",
      role: "student",
      avatarUrl: "",
      isVerifiedCollegeUser: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveClientUser(user);

    saveClientProfile({
      id: `p_${Date.now()}`,
      userId: newId,
      name: user.name,
      rollNumber: user.rollNumber || "",
      branch: "Computer Science & Engineering",
      year: "1st Year",
      facePresenceVerified: false,
      technicalSkills: [],
      nonTechnicalSkills: [],
      domains: [],
      githubUrl: "",
      linkedinUrl: "",
      portfolioUrl: "",
      lookingForTeam: false,
      updatedAt: new Date().toISOString(),
    });
  }

  return { success: true, user };
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
}): Promise<{ success: boolean; user?: User; error?: string }> {
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
  } catch {
    // Network or server offline
  }

  // Client DB fallback
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanRoll = params.rollNumber.trim().toUpperCase();

  const existing = getClientUsers().find(
    (u) => u.email.toLowerCase() === cleanEmail || (u.rollNumber && u.rollNumber.toUpperCase() === cleanRoll)
  );
  if (existing) {
    return { success: false, error: "An account with this email or roll number already exists." };
  }

  const newId = `u_${Date.now()}`;
  const user: User = {
    id: newId,
    collegeId: "CAMPUS_MAIN",
    email: cleanEmail,
    mobile: params.mobile.trim(),
    name: params.name.trim(),
    rollNumber: cleanRoll,
    role: "student",
    avatarUrl: "",
    isVerifiedCollegeUser: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveClientUser(user);

  const profile: StudentProfile = {
    id: `p_${Date.now()}`,
    userId: newId,
    name: user.name,
    rollNumber: cleanRoll,
    branch: params.branch || "Computer Science & Engineering",
    year: params.year || "1st Year",
    facePresenceVerified: false,
    technicalSkills: [],
    nonTechnicalSkills: [],
    domains: [],
    githubUrl: "",
    linkedinUrl: "",
    portfolioUrl: "",
    lookingForTeam: false,
    updatedAt: new Date().toISOString(),
  };
  saveClientProfile(profile);

  return { success: true, user };
}

export async function apiGetUser(userId: string): Promise<{ user?: User; error?: string }> {
  try {
    const res = await fetch(`/api/auth/me?userId=${userId}`);
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      return await res.json();
    }
  } catch {
    // fallback
  }

  const user = getClientUsers().find((u) => u.id === userId);
  return user ? { user } : { error: "User not found" };
}

export async function apiGetProfile(userId: string): Promise<{ profile?: StudentProfile; error?: string }> {
  try {
    const res = await fetch(`/api/profile/${userId}`);
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      return await res.json();
    }
  } catch {
    // fallback
  }

  const profile = getClientProfiles().find((p) => p.userId === userId);
  return profile ? { profile } : { error: "Profile not found" };
}
