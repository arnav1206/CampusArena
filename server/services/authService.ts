// =============================================================================
// Campus Arena — Auth & Session Service (Real OTPs + SQLite)
// =============================================================================
//
// OTP Delivery:
//   - If GMAIL_USER and GMAIL_PASS are set in .env, OTPs are emailed via Gmail.
//   - If FAST2SMS_KEY is set, OTPs are sent via SMS (Fast2SMS, free Indian SMS API).
//   - Otherwise, OTP is printed to the server console and returned in the API
//     response as `devOtp` so you can copy-paste it during testing.
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
  // ──────────────────────────────────────────────────────────────────────────
  // Request a single OTP (login flow — email OR mobile)
  // ──────────────────────────────────────────────────────────────────────────
  static async requestOtp(
    identifier: string,
    type: "email" | "mobile" = "email"
  ): Promise<{ success: boolean; message: string; devOtp?: string }> {
    const clean = identifier.trim().toLowerCase().replace(/\s+/g, "");
    if (!clean) return { success: false, message: "Identifier is required." };

    const otp = generateOtp();
    otpHelpers.set(clean, otp);

    let delivered = false;
    if (type === "email") {
      delivered = await sendEmailOtp(identifier.trim(), otp);
    } else {
      delivered = await sendSmsOtp(identifier.trim(), otp);
    }

    if (!delivered) {
      // Dev fallback — print to console
      console.log(`\n[AUTH] ⚡ OTP for ${identifier}: ${otp}\n`);
    }

    return {
      success: true,
      message: delivered
        ? `Verification code sent to ${identifier}`
        : `[Dev] OTP generated — check server console`,
      // Only expose devOtp when not delivered (no real credentials set up)
      ...(!delivered && { devOtp: otp }),
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
    devEmailOtp?: string;
    devMobileOtp?: string;
  }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobile.trim().replace(/\s+/g, "");

    if (!cleanEmail || !cleanMobile) {
      return { success: false, message: "Both email and mobile are required." };
    }

    const emailOtp = generateOtp();
    const mobileOtp = generateOtp();

    otpHelpers.set(cleanEmail, emailOtp);
    otpHelpers.set(cleanMobile, mobileOtp);

    const emailDelivered = await sendEmailOtp(email.trim(), emailOtp);
    const smsDelivered = await sendSmsOtp(mobile.trim(), mobileOtp);

    if (!emailDelivered) console.log(`\n[AUTH] ⚡ Email OTP for ${email}: ${emailOtp}\n`);
    if (!smsDelivered) console.log(`\n[AUTH] ⚡ Mobile OTP for ${mobile}: ${mobileOtp}\n`);

    return {
      success: true,
      message: "Verification codes dispatched.",
      ...(!emailDelivered && { devEmailOtp: emailOtp }),
      ...(!smsDelivered && { devMobileOtp: mobileOtp }),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Verify single OTP and log in / create user
  // ──────────────────────────────────────────────────────────────────────────
  static verifyOtp(
    identifier: string,
    code: string
  ): { success: boolean; user?: User; error?: string } {
    const cleanId = identifier.trim().toLowerCase().replace(/\s+/g, "");
    const entry = otpHelpers.get(cleanId);

    if (!entry || entry.code !== code.trim()) {
      if (entry) otpHelpers.incrementAttempts(cleanId);
      return { success: false, error: "Invalid or expired verification code." };
    }

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
        name: isEmail
          ? cleanId.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
          : "New Student",
        role: "student",
      });
      profileHelpers.create({
        id: `p_${Date.now()}`,
        userId: newId,
        name: user.name,
      });
    }

    return { success: true, user: user as User };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Verify dual OTPs (login after dual-OTP request)
  // ──────────────────────────────────────────────────────────────────────────
  static verifyDualOtp(params: {
    email: string;
    emailOtp: string;
    mobile: string;
    mobileOtp: string;
  }): { success: boolean; user?: User; error?: string } {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanMobile = params.mobile.trim().replace(/\s+/g, "");

    const emailEntry = otpHelpers.get(cleanEmail);
    const mobileEntry = otpHelpers.get(cleanMobile);

    const emailValid = emailEntry !== null && emailEntry.code === params.emailOtp.trim();
    const mobileValid = mobileEntry !== null && mobileEntry.code === params.mobileOtp.trim();

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

    return { success: true, user: user as User };
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
  }): { success: boolean; user?: User; error?: string } {
    const { name, rollNumber, email, emailOtp, mobile, mobileOtp, branch, year } = params;

    if (!rollNumber?.trim()) return { success: false, error: "Roll Number / Student ID is required." };
    if (!email?.trim() || !email.includes("@")) return { success: false, error: "Valid college email is required." };
    if (!mobile?.trim()) return { success: false, error: "Mobile number is required." };

    // Verify both OTPs
    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobile.trim().replace(/\s+/g, "");

    const emailEntry = otpHelpers.get(cleanEmail);
    const mobileEntry = otpHelpers.get(cleanMobile);

    if (!emailEntry || emailEntry.code !== emailOtp.trim()) {
      return { success: false, error: "Email OTP is invalid or has expired. Please request a new code." };
    }
    if (!mobileEntry || mobileEntry.code !== mobileOtp.trim()) {
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
    return { success: true, user: user as User };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Account Recovery — find existing account by email + mobile (dual OTP)
  // ──────────────────────────────────────────────────────────────────────────
  static recoverAccount(params: {
    email: string;
    emailOtp: string;
    mobile: string;
    mobileOtp: string;
  }): { success: boolean; user?: User; error?: string } {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanMobile = params.mobile.trim().replace(/\s+/g, "");

    const emailEntry = otpHelpers.get(cleanEmail);
    const mobileEntry = otpHelpers.get(cleanMobile);

    if (!emailEntry || emailEntry.code !== params.emailOtp.trim()) {
      return { success: false, error: "Email OTP is invalid or has expired." };
    }
    if (!mobileEntry || mobileEntry.code !== params.mobileOtp.trim()) {
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
    return { success: true, user: user as User };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Quick role switcher (demo / admin use)
  // ──────────────────────────────────────────────────────────────────────────
  static switchUserRole(userId: string, newRole: PlatformRole): User | undefined {
    const updated = userHelpers.updateRole(userId, newRole);
    return updated as User | undefined;
  }
}
