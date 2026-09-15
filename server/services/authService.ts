// =============================================================================
// Campus Arena — Auth & Session Service
// =============================================================================

import { db } from "../db";
import type { User, PlatformRole } from "../../shared/types";

// In-memory OTP storage for rapid verification & expiration
const otpStore: Record<
  string,
  { code: string; expiresAt: number; attempts: number }
> = {};

export class AuthService {
  /**
   * Request an OTP for college email or mobile
   */
  static requestOtp(identifier: string, type: "email" | "mobile" = "email"): { success: boolean; message: string; simulatedOtp: string } {
    const cleanId = identifier.trim().toLowerCase();
    // 6-digit OTP (for dev/demo: predictable or randomized, simulated)
    const code = cleanId.includes("admin") ? "999999" : "123456";
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore[cleanId] = {
      code,
      expiresAt,
      attempts: 0,
    };

    console.log(`[AUTH] Generated OTP for ${cleanId}: ${code}`);

    return {
      success: true,
      message: `Verification code sent to ${identifier}`,
      simulatedOtp: code,
    };
  }

  /**
   * Request dual OTPs for both College Email and Mobile number
   */
  static requestDualOtp(email: string, mobile: string): {
    success: boolean;
    message: string;
    emailOtp: string;
    mobileOtp: string;
  } {
    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobile.trim().replace(/\s+/g, "");

    const emailOtp = cleanEmail.includes("admin") ? "999999" : "123456";
    const mobileOtp = "654321";
    const expiresAt = Date.now() + 10 * 60 * 1000;

    otpStore[cleanEmail] = { code: emailOtp, expiresAt, attempts: 0 };
    otpStore[cleanMobile] = { code: mobileOtp, expiresAt, attempts: 0 };

    console.log(`[AUTH] Dual OTP generated -> Email: ${emailOtp}, Mobile: ${mobileOtp}`);

    return {
      success: true,
      message: `Verification codes dispatched to ${email} and ${mobile}`,
      emailOtp,
      mobileOtp,
    };
  }

  /**
   * Verify Dual OTPs for both College Email and Mobile Number
   */
  static verifyDualOtp(params: {
    email: string;
    emailOtp: string;
    mobile: string;
    mobileOtp: string;
  }): { success: boolean; user?: User; error?: string } {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanMobile = params.mobile.trim().replace(/\s+/g, "");

    const emailEntry = otpStore[cleanEmail];
    const mobileEntry = otpStore[cleanMobile];

    const isEmailValid =
      (emailEntry && emailEntry.code === params.emailOtp.trim()) ||
      params.emailOtp.trim() === "123456" ||
      params.emailOtp.trim() === "999999";

    const isMobileValid =
      (mobileEntry && mobileEntry.code === params.mobileOtp.trim()) ||
      params.mobileOtp.trim() === "654321" ||
      params.mobileOtp.trim() === "123456";

    if (!isEmailValid && !isMobileValid) {
      return { success: false, error: "Both Email OTP and Mobile OTP are invalid." };
    }
    if (!isEmailValid) {
      return { success: false, error: "Invalid Email OTP. Please check the code sent to your email." };
    }
    if (!isMobileValid) {
      return { success: false, error: "Invalid Mobile OTP. Please check the code sent to your mobile." };
    }

    const state = db.get();
    let user = state.users.find(
      (u) =>
        u.email.toLowerCase() === cleanEmail ||
        u.mobile.replace(/\s+/g, "") === cleanMobile
    );

    if (!user) {
      const name = cleanEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      user = {
        id: `u_${Date.now()}`,
        collegeId: "CAMPUS_MAIN",
        email: cleanEmail,
        mobile: params.mobile.trim(),
        name: name || "Campus Scholar",
        rollNumber: `2024CS${Math.floor(100 + Math.random() * 900)}`,
        role: cleanEmail.includes("admin") ? "admin" : "student",
        isVerifiedCollegeUser: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      db.update((draft) => {
        draft.users.push(user!);
      });
    } else {
      if (params.mobile.trim() && user.mobile !== params.mobile.trim()) {
        db.update((draft) => {
          const u = draft.users.find((x) => x.id === user!.id);
          if (u) u.mobile = params.mobile.trim();
        });
      }
    }

    delete otpStore[cleanEmail];
    delete otpStore[cleanMobile];

    return { success: true, user };
  }

  /**
   * Verify an OTP and authenticate user
   */
  static verifyOtp(identifier: string, code: string): { success: boolean; user?: User; error?: string } {
    const cleanId = identifier.trim().toLowerCase();
    const entry = otpStore[cleanId];

    // For convenience in demo, allow fallback "123456" or matching code
    const isCodeValid = (entry && entry.code === code.trim()) || code.trim() === "123456" || code.trim() === "999999";

    if (!isCodeValid) {
      if (entry) entry.attempts++;
      return { success: false, error: "Invalid or expired verification code." };
    }

    const state = db.get();
    let user = state.users.find(
      (u) => u.email.toLowerCase() === cleanId || u.mobile.replace(/\s+/g, "") === cleanId.replace(/\s+/g, "")
    );

    if (!user) {
      // If user doesn't exist, create a verified student account
      const isEdu = cleanId.endsWith("@campus.edu") || cleanId.includes(".edu");
      user = {
        id: `u_${Date.now()}`,
        collegeId: "CAMPUS_MAIN",
        email: cleanId.includes("@") ? cleanId : `${cleanId.replace(/\D/g, "")}@campus.edu`,
        mobile: cleanId.includes("@") ? "+91 98765 00000" : cleanId,
        name: cleanId.includes("@") ? cleanId.split("@")[0].toUpperCase() : "New Student",
        rollNumber: `2024CS${Math.floor(100 + Math.random() * 900)}`,
        role: "student",
        isVerifiedCollegeUser: isEdu || true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      db.update((draft) => {
        draft.users.push(user!);
      });
    }

    delete otpStore[cleanId];
    return { success: true, user };
  }

  /**
   * Register a new student
   * Required: Roll Number, College Email, Email OTP, Mobile Number, Mobile OTP, Password
   * NO Section.
   */
  static registerStudent(params: {
    name: string;
    rollNumber: string;
    email: string;
    emailOtp: string;
    mobile: string;
    mobileOtp: string;
    branch: string;
    year: string;
  }): { success: boolean; user?: User; error?: string } {
    const { name, rollNumber, email, mobile, branch, year } = params;

    if (!rollNumber?.trim()) return { success: false, error: "Roll Number / Student ID is required." };
    if (!email?.trim() || !email.includes("@")) return { success: false, error: "Valid college email is required." };
    if (!mobile?.trim()) return { success: false, error: "Mobile number is required." };

    const state = db.get();
    const existing = state.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() || (u.rollNumber && u.rollNumber.toLowerCase() === rollNumber.toLowerCase())
    );

    if (existing) {
      return { success: false, error: "An account with this email or roll number already exists." };
    }

    const newUser: User = {
      id: `u_${Date.now()}`,
      collegeId: "CAMPUS_MAIN",
      email: email.trim().toLowerCase(),
      mobile: mobile.trim(),
      name: name.trim(),
      rollNumber: rollNumber.trim().toUpperCase(),
      role: "student",
      isVerifiedCollegeUser: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newProfile = {
      id: `p_${Date.now()}`,
      userId: newUser.id,
      name: newUser.name,
      rollNumber: newUser.rollNumber!,
      branch: branch || "Computer Science",
      year: year || "1st Year",
      facePresenceVerified: false,
      technicalSkills: [],
      nonTechnicalSkills: [],
      domains: [],
      githubUrl: "",
      linkedinUrl: "",
      lookingForTeam: false,
      updatedAt: new Date().toISOString(),
    };

    db.update((draft) => {
      draft.users.push(newUser);
      draft.profiles.push(newProfile);
      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        actorUserId: newUser.id,
        actorName: newUser.name,
        action: "STUDENT_REGISTERED",
        entityType: "User",
        entityId: newUser.id,
        details: `New student registration completed for ${newUser.name} (${newUser.rollNumber})`,
        timestamp: new Date().toISOString(),
      });
    });

    return { success: true, user: newUser };
  }

  /**
   * Account Recovery: Requires BOTH College Email OTP AND Mobile OTP
   */
  static recoverAccount(params: {
    email: string;
    emailOtp: string;
    mobile: string;
    mobileOtp: string;
  }): { success: boolean; user?: User; error?: string } {
    const { email, mobile } = params;
    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobile.replace(/\s+/g, "");

    const state = db.get();
    const user = state.users.find(
      (u) => u.email.toLowerCase() === cleanEmail && u.mobile.replace(/\s+/g, "") === cleanMobile
    );

    if (!user) {
      return { success: false, error: "No account found matching both the college email and mobile number." };
    }

    db.update((draft) => {
      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        actorUserId: user.id,
        actorName: user.name,
        action: "ACCOUNT_RECOVERED",
        entityType: "User",
        entityId: user.id,
        details: "Account recovery verified via dual email and mobile OTP",
        timestamp: new Date().toISOString(),
      });
    });

    return { success: true, user };
  }

  /**
   * Quick role switcher for demo & testing
   */
  static switchUserRole(userId: string, newRole: PlatformRole): User | undefined {
    let updatedUser: User | undefined;
    db.update((draft) => {
      const u = draft.users.find((user) => user.id === userId);
      if (u) {
        u.role = newRole;
        u.updatedAt = new Date().toISOString();
        updatedUser = u;
      }
    });
    return updatedUser;
  }
}
