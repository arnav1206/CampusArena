// =============================================================================
// Campus Arena — Auth & Session Service (Real OTPs + SQLite)
// =============================================================================
//
// OTP Delivery:
//   - If GMAIL_USER and GMAIL_PASS are set in .env, OTPs are emailed via Gmail.
//   - If FAST2SMS_KEY is set, OTPs are sent via SMS (Fast2SMS, free Indian SMS API).
//   - Delivery credentials are mandatory outside local development. Codes are
//     never returned to the browser or written to logs.
//
// =============================================================================

import { userHelpers, profileHelpers, otpHelpers } from "../db";
import type { User, PlatformRole } from "../../shared/types";
import crypto from "node:crypto";

// ── Optional email transport (loaded lazily so app starts without credentials) ──
let transporter: import("nodemailer").Transporter | null = null;

async function getEmailTransporter() {
  if (transporter) return transporter;
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) return null;

  try {
    const nodemailer = await import("nodemailer");
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });
    console.log("[AUTH] Gmail transporter ready:", process.env.GMAIL_USER);
    return transporter;
  } catch {
    return null;
  }
}

// ── Generate a secure random 6-digit OTP ──
function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

const MAX_OTP_ATTEMPTS = 5;
const PLATFORM_ADMIN_EMAIL = (process.env.PLATFORM_ADMIN_EMAIL || "platform.admin@campusarena.in")
  .trim()
  .toLowerCase();
const PLATFORM_ADMIN_NAME = process.env.PLATFORM_ADMIN_NAME || "Platform Admin";
const SESSION_SECRET = process.env.AUTH_SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function isValidMobile(value: string) {
  return value.replace(/\D/g, "").length === 10;
}

function validateStoredOtp(identifier: string, code: string): { success: boolean; error?: string } {
  const entry = otpHelpers.get(identifier);
  if (!entry) return { success: false, error: "This verification code has expired. Please request a new one." };
  if (entry.attempts >= MAX_OTP_ATTEMPTS) {
    otpHelpers.delete(identifier);
    return { success: false, error: "Too many attempts. Please request a new verification code." };
  }
  if (entry.code !== code.trim()) {
    otpHelpers.incrementAttempts(identifier);
    return { success: false, error: "Invalid verification code." };
  }
  return { success: true };
}

function createSessionToken(userId: string) {
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Date.now() + SESSION_TTL_MS })).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

// ── Send email OTP ──
async function sendEmailOtp(to: string, otp: string): Promise<boolean> {
  const mail = await getEmailTransporter();
  if (!mail) return false;

  try {
    await mail.sendMail({
      from: `"Campus Arena" <${process.env.GMAIL_USER}>`,
      to,
      subject: "Your Campus Arena verification code",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#172017">Campus Arena OTP</h2>
          <p>Your verification code is:</p>
          <div style="font-size:36px;font-weight:900;letter-spacing:0.15em;color:#6a9c28;padding:16px 0">${otp}</div>
          <p style="color:#666;font-size:13px">This code expires in 10 minutes. Do not share it with anyone.</p>
        </div>
      `,
    });
    console.log(`[AUTH] Email OTP sent to ${to}`);
    return true;
  } catch (err) {
    console.error("[AUTH] Email send failed:", err);
    return false;
  }
}

// ── Send SMS OTP via Fast2SMS ──
async function sendSmsOtp(mobile: string, otp: string): Promise<boolean> {
  if (!process.env.FAST2SMS_KEY) return false;

  try {
    const phone = mobile.replace(/\D/g, "").slice(-10); // last 10 digits
    const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${process.env.FAST2SMS_KEY}&variables_values=${otp}&route=otp&numbers=${phone}`;
    const res = await fetch(url);
    const data = (await res.json()) as { return?: boolean };
    if (data.return) {
      console.log(`[AUTH] SMS OTP sent to ${mobile}`);
      return true;
    }
    return false;
  } catch (err) {
    console.error("[AUTH] SMS send failed:", err);
    return false;
  }
}

export class AuthService {
  static getSessionUser(token?: string): User | undefined {
    if (!token) return undefined;
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return undefined;
    const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return undefined;
    try {
      const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: string; exp?: number };
      if (!data.sub || !data.exp || data.exp < Date.now()) return undefined;
      return userHelpers.findById(data.sub) as User | undefined;
    } catch { return undefined; }
  }
  // ──────────────────────────────────────────────────────────────────────────
  // Request a single OTP (login flow — email OR mobile)
  // ──────────────────────────────────────────────────────────────────────────
  static async requestOtp(
    identifier: string,
    type: "email" | "mobile" = "email"
  ): Promise<{ success: boolean; message: string }> {
    const clean = identifier.trim().toLowerCase().replace(/\s+/g, "");
    if (!clean) return { success: false, message: "Identifier is required." };
    if (type === "email" && !clean.includes("@")) return { success: false, message: "Enter a valid email address." };
    if (type === "mobile" && !isValidMobile(identifier)) return { success: false, message: "Enter a valid 10-digit mobile number." };

    const otp = generateOtp();

    let delivered = false;
    if (type === "email") {
      delivered = await sendEmailOtp(identifier.trim(), otp);
    } else {
      delivered = await sendSmsOtp(identifier.trim(), otp);
    }

    if (!delivered) return { success: false, message: `Unable to send an OTP to this ${type}. Check the delivery service configuration and try again.` };

    otpHelpers.set(clean, otp);

    return {
      success: true,
      message: `Verification code sent to ${identifier}`,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Request dual OTPs (register / recover — both email AND mobile)
  // ──────────────────────────────────────────────────────────────────────────
  static async requestDualOtp(
    email: string,
    mobile: string
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobile.trim().replace(/\s+/g, "");

    if (!cleanEmail || !cleanMobile) {
      return { success: false, message: "Both email and mobile are required." };
    }
    if (!cleanEmail.includes("@") || !isValidMobile(mobile)) {
      return { success: false, message: "Enter a valid email address and 10-digit mobile number." };
    }

    const emailOtp = generateOtp();
    const mobileOtp = generateOtp();

    const emailDelivered = await sendEmailOtp(email.trim(), emailOtp);
    const smsDelivered = await sendSmsOtp(mobile.trim(), mobileOtp);

    if (!emailDelivered || !smsDelivered) {
      return { success: false, message: "We could not deliver both verification codes. Check the email and SMS configuration, then try again." };
    }

    otpHelpers.set(cleanEmail, emailOtp);
    otpHelpers.set(cleanMobile, mobileOtp);

    return {
      success: true,
      message: "Verification codes dispatched.",
    };
  }

  /** Validate a code for the UI without consuming it; registration consumes both. */
  static validateOtp(identifier: string, code: string): { success: boolean; error?: string } {
    const clean = identifier.trim().toLowerCase().replace(/\s+/g, "");
    return validateStoredOtp(clean, code);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Verify single OTP and log in / create user
  // ──────────────────────────────────────────────────────────────────────────
  static verifyOtp(
    identifier: string,
    code: string
  ): { success: boolean; user?: User; sessionToken?: string; error?: string } {
    const cleanId = identifier.trim().toLowerCase().replace(/\s+/g, "");
    const validation = validateStoredOtp(cleanId, code);
    if (!validation.success) return validation;

    otpHelpers.delete(cleanId);

    // Find existing user by email or mobile
    let user =
      userHelpers.findByEmail(cleanId) ??
      userHelpers.findByMobile(cleanId);

    if (!user) {
      // Auto-create a basic account for new users logging in
      const isEmail = cleanId.includes("@");
      const newId = `u_${Date.now()}`;
      user = userHelpers.create({
        id: newId,
        email: isEmail ? cleanId : `${cleanId.replace(/\D/g, "")}@campus.edu`,
        mobile: isEmail ? "" : cleanId,
        name: cleanId === PLATFORM_ADMIN_EMAIL
          ? PLATFORM_ADMIN_NAME
          : isEmail
          ? cleanId.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
          : "New Student",
        role: cleanId === PLATFORM_ADMIN_EMAIL ? "admin" : "student",
      });
      profileHelpers.create({
        id: `p_${Date.now()}`,
        userId: newId,
        name: user.name,
      });
    }

    if (cleanId === PLATFORM_ADMIN_EMAIL && user.role !== "admin") {
      user = userHelpers.updateRole(user.id, "admin") as User;
    }
    return { success: true, user: user as User, sessionToken: createSessionToken(user.id) };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Verify dual OTPs (login after dual-OTP request)
  // ──────────────────────────────────────────────────────────────────────────
  static verifyDualOtp(params: {
    email: string;
    emailOtp: string;
    mobile: string;
    mobileOtp: string;
  }): { success: boolean; user?: User; sessionToken?: string; error?: string } {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanMobile = params.mobile.trim().replace(/\s+/g, "");

    const emailValid = validateStoredOtp(cleanEmail, params.emailOtp).success;
    const mobileValid = validateStoredOtp(cleanMobile, params.mobileOtp).success;

    if (!emailValid && !mobileValid)
      return { success: false, error: "Both Email OTP and Mobile OTP are invalid." };
    if (!emailValid)
      return { success: false, error: "Invalid Email OTP. Check the code sent to your inbox." };
    if (!mobileValid)
      return { success: false, error: "Invalid Mobile OTP. Check the code sent to your phone." };

    otpHelpers.delete(cleanEmail);
    otpHelpers.delete(cleanMobile);

    let user =
      userHelpers.findByEmail(cleanEmail) ?? userHelpers.findByMobile(cleanMobile);

    if (!user) {
      const name = cleanEmail
        .split("@")[0]
        .replace(/[._]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      const newId = `u_${Date.now()}`;
      user = userHelpers.create({
        id: newId,
        email: cleanEmail,
        mobile: params.mobile.trim(),
        name: name || "Campus Scholar",
        role: "student",
      });
      profileHelpers.create({ id: `p_${Date.now()}`, userId: newId, name: user.name });
    } else if (params.mobile.trim() && user.mobile !== params.mobile.trim()) {
      userHelpers.updateMobile(user.id, params.mobile.trim());
      user = userHelpers.findById(user.id)!;
    }

    return { success: true, user: user as User, sessionToken: createSessionToken(user.id) };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Register a new student account (full form — name, roll, branch, year)
  // ──────────────────────────────────────────────────────────────────────────
  static registerStudent(params: {
    name: string;
    rollNumber: string;
    email: string;
    emailOtp: string;
    mobile: string;
    mobileOtp: string;
    branch: string;
    year: string;
  }): { success: boolean; user?: User; sessionToken?: string; error?: string } {
    const { name, rollNumber, email, emailOtp, mobile, mobileOtp, branch, year } = params;

    if (!rollNumber?.trim()) return { success: false, error: "Roll Number / Student ID is required." };
    if (!email?.trim() || !email.includes("@")) return { success: false, error: "Valid college email is required." };
    if (!mobile?.trim()) return { success: false, error: "Mobile number is required." };

    // Verify both OTPs
    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobile.trim().replace(/\s+/g, "");

    const emailCheck = validateStoredOtp(cleanEmail, emailOtp);
    const mobileCheck = validateStoredOtp(cleanMobile, mobileOtp);
    if (!emailCheck.success) {
      return { success: false, error: "Email OTP is invalid or has expired. Please request a new code." };
    }
    if (!mobileCheck.success) {
      return { success: false, error: "Mobile OTP is invalid or has expired. Please request a new code." };
    }

    // Check duplicates
    if (userHelpers.findByEmail(cleanEmail)) {
      return { success: false, error: "An account with this email already exists. Please sign in." };
    }
    if (userHelpers.findByRollNumber(rollNumber.trim())) {
      return { success: false, error: "An account with this roll number already exists." };
    }

    otpHelpers.delete(cleanEmail);
    otpHelpers.delete(cleanMobile);

    const newId = `u_${Date.now()}`;
    const user = userHelpers.create({
      id: newId,
      email: cleanEmail,
      mobile: mobile.trim(),
      name: name.trim(),
      rollNumber: rollNumber.trim().toUpperCase(),
      role: "student",
    });

    profileHelpers.create({
      id: `p_${Date.now()}`,
      userId: newId,
      name: user.name,
      rollNumber: rollNumber.trim().toUpperCase(),
      branch: branch || "Computer Science & Engineering",
      year: year || "1st Year",
    });

    console.log(`[AUTH] ✅ New student registered: ${user.name} (${user.email})`);
    return { success: true, user: user as User, sessionToken: createSessionToken(user.id) };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Account Recovery — find existing account by email + mobile (dual OTP)
  // ──────────────────────────────────────────────────────────────────────────
  static recoverAccount(params: {
    email: string;
    emailOtp: string;
    mobile: string;
    mobileOtp: string;
  }): { success: boolean; user?: User; sessionToken?: string; error?: string } {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanMobile = params.mobile.trim().replace(/\s+/g, "");

    const emailCheck = validateStoredOtp(cleanEmail, params.emailOtp);
    const mobileCheck = validateStoredOtp(cleanMobile, params.mobileOtp);
    if (!emailCheck.success) {
      return { success: false, error: "Email OTP is invalid or has expired." };
    }
    if (!mobileCheck.success) {
      return { success: false, error: "Mobile OTP is invalid or has expired." };
    }

    const user = userHelpers.findByEmail(cleanEmail);
    if (!user) {
      return {
        success: false,
        error: "No account found with this email. Please register first.",
      };
    }

    otpHelpers.delete(cleanEmail);
    otpHelpers.delete(cleanMobile);

    console.log(`[AUTH] 🔄 Account recovered: ${user.name}`);
    return { success: true, user: user as User, sessionToken: createSessionToken(user.id) };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Quick role switcher (demo / admin use)
  // ──────────────────────────────────────────────────────────────────────────
  static switchUserRole(userId: string, newRole: PlatformRole): User | undefined {
    const updated = userHelpers.updateRole(userId, newRole);
    return updated as User | undefined;
  }
}
