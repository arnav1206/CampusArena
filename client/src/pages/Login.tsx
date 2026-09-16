// =============================================================================
// Campus Arena — Login Page with Dual OTP Verification
// =============================================================================

import React, { useState, useEffect, useRef } from "react";
import { animated, useSpring, useTrail, useTransition } from "@react-spring/web";
import {
  ArrowRight,
  Check,
  KeyRound,
  LockKeyhole,
  Mail,
  Moon,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  UserCheck,
  UserRound,
  AlertTriangle,
  BookOpen,
  Trophy,
  Zap,
  ChevronRight,
  Eye,
  EyeOff,
  Timer,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useLocation } from "wouter";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { apiRequestOtp, apiRequestDualOtp, apiValidateOtp } from "@/lib/authClientDb";

type AuthMode = "login" | "register" | "recover";
type LoginStep = "credentials" | "verify";
type SignInMethod = "otp" | "password";

const FEATURES = [
  { icon: Trophy, title: "One unified login", desc: "Students, organisers, judges & admin — one campus identity" },
  { icon: ShieldCheck, title: "Dual OTP security", desc: "Both email & mobile OTP verified before entry" },
  { icon: Zap, title: "Permanent profile", desc: "Your skills, teams & certificates persist across all events" },
  { icon: BookOpen, title: "Full competition lifecycle", desc: "Register → Pay → Submit → Judge → Cert, all in one place" },
];

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function OtpInput({
  value,
  onChange,
  onComplete,
  autoFocus = false,
  error = false,
  verified = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: () => void;
  autoFocus?: boolean;
  error?: boolean;
  verified?: boolean;
}) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const digits = value.padEnd(6, "").split("").slice(0, 6);

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
      const newVal = digits.map((d, j) => (j === i - 1 ? "" : d)).join("");
      onChange(newVal.trimEnd());
    }
  }

  function handleChange(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      const newVal = digits.map((d, j) => (j === i ? "" : d)).join("");
      onChange(newVal);
      return;
    }
    if (raw.length > 1) {
      // Paste
      const pasted = raw.slice(0, 6);
      onChange(pasted);
      if (pasted.length === 6) {
        inputs.current[5]?.blur();
        onComplete?.();
      } else {
        inputs.current[Math.min(pasted.length, 5)]?.focus();
      }
      return;
    }
    const newVal = digits.map((d, j) => (j === i ? raw : d)).join("");
    onChange(newVal);
    if (i < 5) {
      setTimeout(() => inputs.current[i + 1]?.focus(), 0);
    } else {
      onComplete?.();
    }
  }

  return (
    <div className="flex justify-between gap-1.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={6}
          autoFocus={autoFocus && i === 0}
          value={digits[i] || ""}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onChange={(e) => handleChange(i, e)}
          className={[
            "h-12 w-full rounded-xl border-2 text-center font-mono text-lg font-extrabold outline-none transition-all",
            verified
              ? "border-[#6abf56] bg-[#f0fced] text-[#3a7d2c] dark:border-[#4a9a3c] dark:bg-[#1b3d18] dark:text-[#c8f0b5]"
              : error
              ? "border-[#e05a5a] bg-[#fef0f0] text-[#c03030] dark:border-[#c04040] dark:bg-[#2e1a1a] dark:text-[#f0b0b0]"
              : digits[i]
              ? "border-[#a7ca61] bg-[#fbfdf6] text-[#2c4a16] dark:border-[#74a83c] dark:bg-[#1b2d14] dark:text-[#d8f0a0]"
              : "border-[#dfe4d8] bg-white text-[#253025] dark:border-[#334033] dark:bg-[#111a12] dark:text-[#eef7ec]",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

function OtpSection({
  label,
  icon: Icon,
  hint,
  value,
  onChange,
  onSend,
  sending,
  sent,
  cooldown,
  verified,
  error,
  onVerify,
  verifying,
}: {
  label: string;
  icon: React.ElementType;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  sent: boolean;
  cooldown: number;
  verified: boolean;
  error: string;
  onVerify: () => void;
  verifying: boolean;
}) {
  return (
    <div className={[
      "rounded-2xl border-2 p-4 transition-all",
      verified
        ? "border-[#6abf56] bg-[#f5fdf2] dark:border-[#4a9a3c] dark:bg-[#16301a]"
        : sent
        ? "border-[#a7ca61] bg-[#fafdf5] dark:border-[#4a6e2a] dark:bg-[#162118]"
        : "border-[#e4e8df] bg-white dark:border-[#2a382b] dark:bg-[#162118]",
    ].join(" ")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={[
            "grid h-8 w-8 place-items-center rounded-xl text-sm transition-colors",
            verified ? "bg-[#c8f0b5] text-[#3a7d2c] dark:bg-[#264a1e] dark:text-[#a0e080]" : "bg-[#eef8d4] text-[#6a9c28] dark:bg-[#283820] dark:text-[#c8e89c]",
          ].join(" ")}>
            {verified ? <CheckCircle2 size={16} /> : <Icon size={15} />}
          </div>
          <span className="text-xs font-extrabold text-[#3b4a3b] dark:text-[#cce0cc]">{label}</span>
        </div>
        {verified ? (
          <span className="flex items-center gap-1 rounded-full bg-[#d0f0c0] px-2.5 py-1 text-[10px] font-bold text-[#2a7a20] dark:bg-[#1e4a18] dark:text-[#a0e080]">
            <Check size={10} strokeWidth={3} /> Verified
          </span>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={sending || cooldown > 0 || sent}
            className="flex items-center gap-1.5 rounded-xl border border-[#d0e4a8] bg-[#f2f9e8] px-3 py-1.5 text-[11px] font-bold text-[#6a9c28] transition hover:bg-[#e8f5d0] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#3e5e2a] dark:bg-[#202e18] dark:text-[#b0d880]"
          >
            {sending ? <Spinner /> : cooldown > 0 ? <Timer size={12} /> : <Mail size={12} />}
            {sending ? "Sending…" : cooldown > 0 ? `${cooldown}s` : sent ? "Resend" : "Send OTP"}
          </button>
        )}
      </div>

      {sent && !verified && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-[#7a8a76] dark:text-[#90a090]">
            {hint}
          </p>
          <OtpInput
            value={value}
            onChange={onChange}
            autoFocus={sent}
            error={!!error}
            verified={verified}
            onComplete={onVerify}
          />
          {error && (
            <p className="flex items-center gap-1 text-[11px] font-semibold text-[#c03030] dark:text-[#f08080]">
              <XCircle size={12} /> {error}
            </p>
          )}
          <button
            type="button"
            onClick={onVerify}
            disabled={verifying || value.length < 6}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#172017] py-2.5 text-xs font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#b8f34a] dark:text-[#172017]"
          >
            {verifying ? <><Spinner /> Verifying…</> : <>Verify Code <ArrowRight size={13} /></>}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { loginWithOtp, loginWithPassword, completePasswordSetup, registerStudent, recoverAccount } = useAuth();

  const [mode, setMode] = useState<AuthMode>("login");

  // Login: single OTP (email or mobile)
  const [loginMethod, setLoginMethod] = useState<"email" | "mobile">("email");
  const [signInMethod, setSignInMethod] = useState<SignInMethod>("otp");
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSetupToken, setPasswordSetupToken] = useState<string | null>(null);
  const [loginOtpSent, setLoginOtpSent] = useState(false);
  const [loginOtp, setLoginOtp] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginOtpError, setLoginOtpError] = useState("");
  const [loginRequestError, setLoginRequestError] = useState("");

  // Register / Recovery: dual OTP
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [mobileOtp, setMobileOtp] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [mobileVerified, setMobileVerified] = useState(false);
  const [emailOtpError, setEmailOtpError] = useState("");
  const [mobileOtpError, setMobileOtpError] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingMobile, setSendingMobile] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [mobileCooldown, setMobileCooldown] = useState(0);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verifyingMobile, setVerifyingMobile] = useState(false);

  // Register extra fields
  const [regName, setRegName] = useState("");
  const [regRoll, setRegRoll] = useState("");
  const [regBranch, setRegBranch] = useState("Computer Science & Engineering");
  const [regYear, setRegYear] = useState("1st Year");
  const [formLoading, setFormLoading] = useState(false);

  // Page entry animation — runs ONCE on mount
  const pageAnim = useSpring({
    from: { opacity: 0, transform: "translateY(24px)" },
    to: { opacity: 1, transform: "translateY(0px)" },
    config: { tension: 220, friction: 24 },
  });

  // Form slide animation — only plays when mode tab changes, NOT on every keystroke
  const prevModeRef = React.useRef(mode);
  const shouldResetForm = prevModeRef.current !== mode;
  if (shouldResetForm) prevModeRef.current = mode;

  const formAnim = useSpring({
    from: { opacity: 0, transform: "translateX(20px)" },
    to: { opacity: 1, transform: "translateX(0px)" },
    config: { tension: 260, friction: 28 },
    reset: shouldResetForm,
  });

  const featureTrail = useTrail(FEATURES.length, {
    from: { opacity: 0, transform: "translateX(-16px)" },
    to: { opacity: 1, transform: "translateX(0px)" },
    delay: 200,
    config: { tension: 220, friction: 22 },
  });

  // Cooldown timer
  useEffect(() => {
    if (emailCooldown > 0) {
      const t = setTimeout(() => setEmailCooldown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [emailCooldown]);
  useEffect(() => {
    if (mobileCooldown > 0) {
      const t = setTimeout(() => setMobileCooldown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [mobileCooldown]);

  /* ── Login: single OTP ── */
  async function handleLoginSendOtp() {
    if (!loginId.trim()) {
      toast.error("Please enter your college email or mobile number.");
      return;
    }
    setLoginRequestError("");
    setLoginLoading(true);
    try {
      const data = await apiRequestOtp(loginId, loginMethod);
      if (data.success) {
        setLoginOtpSent(true);
        toast.success("Verification code sent!", { description: `Check your ${loginMethod === "email" ? "inbox" : "phone"}` });
      } else {
        setLoginRequestError(data.message || "Failed to send code.");
      }
    } catch {
      toast.error("An unexpected error occurred while requesting OTP.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLoginVerify() {
    setLoginLoading(true);
    setLoginOtpError("");
    const result = await loginWithOtp(loginId, loginOtp);
    setLoginLoading(false);
    if (result.success) {
      if (result.passwordSetupRequired && result.passwordSetupToken) {
        setPasswordSetupToken(result.passwordSetupToken);
        setLoginPassword("");
        setConfirmPassword("");
        toast.success("Identity verified. Create your password to finish first-time sign in.");
      } else setLocation("/");
    } else {
      setLoginOtpError(result.error || "Verification failed");
    }
  }

  async function handlePasswordLogin() {
    if (!loginId.trim() || !loginPassword) {
      setLoginRequestError("Enter your registered email or mobile number and password.");
      return;
    }
    setLoginLoading(true); setLoginRequestError("");
    const result = await loginWithPassword(loginId, loginPassword);
    setLoginLoading(false);
    if (result.success) setLocation("/");
    else setLoginRequestError(result.error || "Unable to sign in.");
  }

  async function handlePasswordSetup() {
    if (!passwordSetupToken) return;
    if (loginPassword !== confirmPassword) { setLoginRequestError("Passwords do not match."); return; }
    setLoginLoading(true); setLoginRequestError("");
    const result = await completePasswordSetup(passwordSetupToken, loginPassword);
    setLoginLoading(false);
    if (result.success) setLocation("/");
    else setLoginRequestError(result.error || "Unable to create password.");
  }

  /* ── Dual OTP: send ── */
  async function sendDualOtps() {
    if (!email.trim() || !mobile.trim()) {
      toast.error("Please enter both email and mobile number first.");
      return;
    }
    setSendingEmail(true);
    setSendingMobile(true);
    try {
      const data = await apiRequestDualOtp(email, mobile);
      if (data.success) {
        setEmailOtpSent(true);
        setMobileOtpSent(true);
        setEmailCooldown(30);
        setMobileCooldown(30);
        toast.success("OTPs dispatched to your email and mobile!", {
          description: "Check your inbox and SMS",
        });
      } else {
        toast.error(data.message || "Failed to send OTPs.");
      }
    } catch {
      toast.error("An unexpected error occurred while requesting OTPs.");
    } finally {
      setSendingEmail(false);
      setSendingMobile(false);
    }
  }


  async function verifyEmailOtp() {
    setVerifyingEmail(true);
    setEmailOtpError("");
    const result = await apiValidateOtp(email, emailOtp);
    if (result.success) {
      setEmailVerified(true);
      toast.success("Email OTP verified ✓");
    } else setEmailOtpError(result.error || "Incorrect email OTP. Check the code sent to your inbox.");
    setVerifyingEmail(false);
  }

  async function verifyMobileOtp() {
    setVerifyingMobile(true);
    setMobileOtpError("");
    const result = await apiValidateOtp(mobile, mobileOtp);
    if (result.success) {
      setMobileVerified(true);
      toast.success("Mobile OTP verified ✓");
    } else setMobileOtpError(result.error || "Incorrect mobile OTP. Check the code sent to your phone.");
    setVerifyingMobile(false);
  }

  /* ── Register ── */
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!emailVerified || !mobileVerified) {
      toast.error("Please verify both email and mobile OTPs before registering.");
      return;
    }
    setFormLoading(true);
    const result = await registerStudent({
      name: regName,
      rollNumber: regRoll,
      email,
      emailOtp: emailOtp || "123456",
      mobile,
      mobileOtp: mobileOtp || "654321",
      branch: regBranch,
      year: regYear,
    });
    setFormLoading(false);
    if (result.success) setLocation("/");
    else toast.error(result.error || "Registration failed");
  }

  /* ── Recovery ── */
  async function handleRecover(e: React.FormEvent) {
    e.preventDefault();
    if (!emailVerified || !mobileVerified) {
      toast.error("Both email and mobile OTPs must be verified to recover your account.");
      return;
    }
    setFormLoading(true);
    const result = await recoverAccount({
      email,
      emailOtp: emailOtp || "123456",
      mobile,
      mobileOtp: mobileOtp || "654321",
    });
    setFormLoading(false);
    if (result.success) setLocation("/");
    else toast.error(result.error || "Recovery failed");
  }

  function resetDualOtp() {
    setEmail(""); setMobile("");
    setEmailOtpSent(false); setMobileOtpSent(false);
    setEmailOtp(""); setMobileOtp("");
    setEmailVerified(false); setMobileVerified(false);
    setEmailOtpError(""); setMobileOtpError("");
    setEmailCooldown(0); setMobileCooldown(0);
  }

  const bothVerified = emailVerified && mobileVerified;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f8f8f4] text-[#253025] dark:bg-[#0e1410] dark:text-[#e8efe3]">
      {/* Ambient background orbs */}
      <div className="pointer-events-none absolute -left-48 -top-56 h-[600px] w-[600px] rounded-full border-[80px] border-[#cdea80]/20 dark:border-[#b8f34a]/8" />
      <div className="pointer-events-none absolute -bottom-64 -right-48 h-[640px] w-[640px] rounded-full border-[100px] border-[#8dc0ff]/12 dark:border-[#79a6ff]/8" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-[#b8f34a]/4 blur-3xl dark:bg-[#b8f34a]/3" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#172017] shadow-[0_4px_0_#7eaa2a]">
            <Sparkles size={20} className="text-[#b8f34a]" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-display text-[18px] font-extrabold leading-none tracking-[-0.04em]">
              campus<span className="text-[#719d2a]">arena</span>
            </div>
            <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[#969991]">Competition OS</div>
          </div>
        </div>
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="grid h-9 w-9 place-items-center rounded-xl border border-[#deded8] bg-white text-[#667066] shadow-sm transition hover:bg-[#f1f3ea] dark:border-[#2b382d] dark:bg-[#18221a] dark:text-[#dbe6d7]"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </header>

      <div className="relative z-10 mx-auto grid max-w-[1280px] gap-12 px-5 pb-16 pt-4 lg:grid-cols-[1fr_480px] lg:items-start lg:gap-16 lg:px-10 lg:pt-8">
        {/* Left — Hero */}
        <animated.div style={pageAnim} className="max-w-[640px]">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d8e9b8] bg-[#f0f9db] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-[#5f8427] dark:border-[#3e5a2a] dark:bg-[#20301c] dark:text-[#c6e58d]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8fca3d]" />
            Your college's competition operating system
          </div>

          <h1 className="font-display max-w-[580px] text-[46px] font-extrabold leading-[0.92] tracking-[-0.07em] text-[#1b281c] sm:text-[68px] dark:text-[#eff7eb]">
            One login<br />
            <span className="text-[#719d2a] dark:text-[#b8f34a]">every arena.</span>
          </h1>

          <p className="mt-5 max-w-[480px] text-base leading-7 text-[#6d7d6d] dark:text-[#9db09a]">
            Sign in with verified dual OTP — your identity secured at both your college email and mobile. One permanent profile for all campus competitions.
          </p>

          <div className="mt-8 space-y-3.5">
            {featureTrail.map((style, i) => {
              const F = FEATURES[i];
              return (
                <animated.div key={i} style={style} className="flex items-start gap-3.5">
                  <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#e8f5bd] text-[#6c9828] dark:bg-[#243b1a] dark:text-[#b8d870]">
                    <F.icon size={15} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#2d3d2d] dark:text-[#d8ead8]">{F.title}</div>
                    <div className="text-xs text-[#7a8a7a] dark:text-[#8a9c8a]">{F.desc}</div>
                  </div>
                </animated.div>
              );
            })}
          </div>

          {/* Real Identity & Database Info Card */}
          <div className="mt-8 rounded-2xl border border-[#e1e5dc] bg-white/70 p-4 backdrop-blur-sm dark:border-[#293a2b] dark:bg-[#182319]/80">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[#5a6a5a] dark:text-[#b0c0b0]">
              <ShieldCheck size={14} className="text-[#719d2a]" />
              Real-Time Verification & Persistent Storage
            </div>
            <p className="text-xs text-[#7a8a7a] dark:text-[#90a090] leading-relaxed">
              Every registration generates a unique, real-time OTP sent directly to your college credentials. Verified accounts and student profiles are permanently stored in the database.
            </p>
          </div>
        </animated.div>

        {/* Right — Auth Card */}
        <animated.div style={pageAnim} className="w-full">
          <div className="rounded-3xl border border-[#e1e5db] bg-white/95 shadow-[0_24px_72px_rgba(28,44,16,.1)] backdrop-blur-md dark:border-[#2b3a2d] dark:bg-[#161e17]/95 dark:shadow-[0_24px_72px_rgba(0,0,0,.35)]">
            {/* Mode Tabs */}
            <div className="border-b border-[#eaeee4] p-4 dark:border-[#263028]">
              <div className="grid grid-cols-3 rounded-xl bg-[#f2f4ee] p-1 text-xs font-bold dark:bg-[#1e2820]">
                {(["login", "register", "recover"] as AuthMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); resetDualOtp(); setLoginOtpSent(false); }}
                    className={[
                      "rounded-lg py-2 capitalize transition-all",
                      mode === m
                        ? "bg-white text-[#1e2e1e] shadow-sm dark:bg-[#2c3e2e] dark:text-[#e8f5e0]"
                        : "text-[#7a887a] hover:text-[#3a4e3a] dark:text-[#8a9c8a] dark:hover:text-[#c0d0c0]",
                    ].join(" ")}
                  >
                    {m === "login" ? "Sign In" : m === "register" ? "Register" : "Recover"}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {/* ── SIGN IN (Single OTP) ── */}
              {mode === "login" && (
                <animated.div style={formAnim} className="space-y-5">
                  <div>
                    <h2 className="font-display text-2xl font-extrabold tracking-[-0.05em] text-[#1a2a1a] dark:text-[#e8f5e0]">
                      Enter your arena.
                    </h2>
                    <p className="mt-1 text-xs text-[#8a9a88] dark:text-[#9aaa98]">
                      First sign-in uses an OTP. After that, choose an OTP or your password.
                    </p>
                  </div>

                  {passwordSetupToken ? (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-[#c8e890] bg-[#f2fde4] p-3.5 text-xs leading-5 text-[#476d22] dark:border-[#4a6a2c] dark:bg-[#1e3018] dark:text-[#b9dc8e]">
                        <ShieldCheck size={15} className="mr-1.5 inline" /> Identity verified. Create a password for faster future sign-ins. You can still use OTP any time.
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-[#4a6044] dark:text-[#a8c0a4]">Create password</label>
                        <input type="password" autoComplete="new-password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handlePasswordSetup()} placeholder="At least 10 characters, letters and numbers" className="w-full rounded-xl border border-[#dde2d6] bg-[#fafcf7] px-3.5 py-3 text-sm outline-none transition focus:border-[#a7ca61] focus:ring-2 focus:ring-[#dff2ab] dark:border-[#324133] dark:bg-[#101a11] dark:text-[#e8f5e0]" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-[#4a6044] dark:text-[#a8c0a4]">Confirm password</label>
                        <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handlePasswordSetup()} placeholder="Re-enter your password" className="w-full rounded-xl border border-[#dde2d6] bg-[#fafcf7] px-3.5 py-3 text-sm outline-none transition focus:border-[#a7ca61] focus:ring-2 focus:ring-[#dff2ab] dark:border-[#324133] dark:bg-[#101a11] dark:text-[#e8f5e0]" />
                      </div>
                      {loginRequestError && <p className="flex items-center gap-1 text-[11px] font-semibold text-[#c03030] dark:text-[#f08080]"><XCircle size={12} /> {loginRequestError}</p>}
                      <button type="button" disabled={loginLoading || loginPassword.length < 10 || !confirmPassword} onClick={handlePasswordSetup} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#b8f34a] py-3.5 text-sm font-extrabold text-[#172017] shadow-[0_5px_0_#7eaa2a] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50">
                        {loginLoading ? <><Spinner /> Saving password…</> : <>Create password & enter <ArrowRight size={15} /></>}
                      </button>
                    </div>
                  ) : <>

                  <div className="grid grid-cols-2 rounded-xl bg-[#f2f4ee] p-1 text-xs font-bold dark:bg-[#1e2820]">
                    {(["otp", "password"] as const).map((method) => (
                      <button key={method} type="button" onClick={() => { setSignInMethod(method); setLoginOtpSent(false); setLoginRequestError(""); }} className={["rounded-lg py-2 transition", signInMethod === method ? "bg-white text-[#1e2e1e] shadow-sm dark:bg-[#2c3e2e] dark:text-[#e8f5e0]" : "text-[#7a887a] dark:text-[#8a9c8a]"].join(" ")}>
                        {method === "otp" ? "One-time code" : "Password"}
                      </button>
                    ))}
                  </div>

                  {/* Method toggle */}
                  {signInMethod === "otp" && <div className="grid grid-cols-2 rounded-xl bg-[#f2f4ee] p-1 text-xs font-bold dark:bg-[#1e2820]">
                    {(["email", "mobile"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => { setLoginMethod(m); setLoginOtpSent(false); }}
                        className={[
                          "flex items-center justify-center gap-1.5 rounded-lg py-2 transition",
                          loginMethod === m
                            ? "bg-white text-[#1e2e1e] shadow-sm dark:bg-[#2c3e2e] dark:text-[#e8f5e0]"
                            : "text-[#7a887a] dark:text-[#8a9c8a]",
                        ].join(" ")}
                      >
                        {m === "email" ? <Mail size={13} /> : <Smartphone size={13} />}
                        {m === "email" ? "College Email" : "Mobile OTP"}
                      </button>
                    ))}
                  </div>}

                  {signInMethod === "otp" && (!loginOtpSent ? (
                    <>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-[#4a6044] dark:text-[#a8c0a4]">
                          {loginMethod === "email" ? "College email address" : "Registered mobile number"}
                        </label>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-[#8a9888]">
                            {loginMethod === "email" ? <Mail size={15} /> : <Smartphone size={15} />}
                          </div>
                          <input
                            value={loginId}
                            onChange={(e) => setLoginId(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleLoginSendOtp()}
                            placeholder={loginMethod === "email" ? "you@campus.edu" : "+91 98765 43210"}
                            className="w-full rounded-xl border border-[#dde2d6] bg-[#fafcf7] py-3 pl-10 pr-3.5 text-sm outline-none transition focus:border-[#a7ca61] focus:ring-2 focus:ring-[#dff2ab] dark:border-[#324133] dark:bg-[#101a11] dark:text-[#e8f5e0] dark:placeholder:text-[#4a5a4a]"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={loginLoading}
                        onClick={handleLoginSendOtp}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#b8f34a] py-3.5 text-sm font-extrabold text-[#172017] shadow-[0_5px_0_#7eaa2a] transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loginLoading ? <><Spinner /> Sending…</> : <>Send One-Time Code <ArrowRight size={15} /></>}
                      </button>
                      {loginRequestError && <p className="flex items-center gap-1 text-[11px] font-semibold text-[#c03030] dark:text-[#f08080]"><XCircle size={12} /> {loginRequestError}</p>}
                    </>
                  ) : (
                    <>
                      <div className="rounded-2xl border border-[#c8e890] bg-[#f2fde4] p-3.5 dark:border-[#4a6a2c] dark:bg-[#1e3018]">
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-8 w-8 place-items-center rounded-xl bg-[#dff2ab] text-[#5a8820] dark:bg-[#324a20] dark:text-[#c8e890]">
                            <ShieldCheck size={16} />
                          </div>
                          <div>
                            <div className="text-xs font-extrabold text-[#3a5a20] dark:text-[#c8e890]">Code dispatched!</div>
                            <div className="text-[11px] text-[#6a8a50] dark:text-[#9ab870]">Sent to {loginId}</div>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-bold text-[#4a6044] dark:text-[#a8c0a4]">
                          Enter 6-digit verification code
                        </label>
                        <OtpInput
                          value={loginOtp}
                          onChange={(v) => { setLoginOtp(v); setLoginOtpError(""); }}
                          onComplete={handleLoginVerify}
                          autoFocus
                          error={!!loginOtpError}
                        />
                        {loginOtpError && (
                          <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-[#c03030] dark:text-[#f08080]">
                            <XCircle size={12} /> {loginOtpError}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={loginLoading || loginOtp.length < 6}
                        onClick={handleLoginVerify}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#172017] py-3.5 text-sm font-bold text-white shadow-[0_5px_0_#0c110c] transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-60 dark:bg-[#b8f34a] dark:text-[#172017] dark:shadow-[0_5px_0_#7eaa2a]"
                      >
                        {loginLoading ? <><Spinner /> Verifying…</> : <>Verify & Enter <ArrowRight size={15} /></>}
                      </button>
                      <button
                        onClick={() => { setLoginOtpSent(false); setLoginOtp(""); setLoginOtpError(""); }}
                        className="w-full text-center text-xs text-[#8a9888] underline-offset-2 hover:underline dark:text-[#7a8a7a]"
                      >
                        ← Change email / mobile
                      </button>
                    </>
                  ))}

                  {signInMethod === "password" && (
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-[#4a6044] dark:text-[#a8c0a4]">Registered email or mobile number</label>
                        <input value={loginId} onChange={(e) => setLoginId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handlePasswordLogin()} autoComplete="username" placeholder="you@campus.edu or +91 98765 43210" className="w-full rounded-xl border border-[#dde2d6] bg-[#fafcf7] px-3.5 py-3 text-sm outline-none transition focus:border-[#a7ca61] focus:ring-2 focus:ring-[#dff2ab] dark:border-[#324133] dark:bg-[#101a11] dark:text-[#e8f5e0]" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-[#4a6044] dark:text-[#a8c0a4]">Password</label>
                        <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handlePasswordLogin()} autoComplete="current-password" placeholder="Enter your password" className="w-full rounded-xl border border-[#dde2d6] bg-[#fafcf7] px-3.5 py-3 text-sm outline-none transition focus:border-[#a7ca61] focus:ring-2 focus:ring-[#dff2ab] dark:border-[#324133] dark:bg-[#101a11] dark:text-[#e8f5e0]" />
                      </div>
                      {loginRequestError && <p className="flex items-center gap-1 text-[11px] font-semibold text-[#c03030] dark:text-[#f08080]"><XCircle size={12} /> {loginRequestError}</p>}
                      <button type="button" disabled={loginLoading || !loginId.trim() || !loginPassword} onClick={handlePasswordLogin} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#b8f34a] py-3.5 text-sm font-extrabold text-[#172017] shadow-[0_5px_0_#7eaa2a] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50">
                        {loginLoading ? <><Spinner /> Signing in…</> : <>Sign in with password <ArrowRight size={15} /></>}
                      </button>
                      <p className="text-center text-[11px] leading-5 text-[#879286] dark:text-[#9aaa98]">First time here? Choose <strong>One-time code</strong> to verify your identity and create a password.</p>
                    </div>
                  )}
                  </>}
                </animated.div>
              )}

              {/* ── REGISTER (Dual OTP) ── */}
              {mode === "register" && (
                <animated.div style={formAnim}>
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <h2 className="font-display text-2xl font-extrabold tracking-[-0.05em] text-[#1a2a1a] dark:text-[#e8f5e0]">
                        Student Registration
                      </h2>
                      <p className="mt-1 text-xs text-[#8a9a88] dark:text-[#9aaa98]">
                        Permanent profile created once. Both email & mobile must be verified.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-[#4a6044] dark:text-[#a8c0a4]">Full Name *</label>
                        <input required value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Tanmay Sharma"
                          className="w-full rounded-xl border border-[#dde2d6] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#b8f34a] dark:border-[#324133] dark:bg-[#101a11] dark:text-[#e8f5e0]" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-[#4a6044] dark:text-[#a8c0a4]">Roll Number *</label>
                        <input required value={regRoll} onChange={(e) => setRegRoll(e.target.value)} placeholder="2024CS099"
                          className="w-full rounded-xl border border-[#dde2d6] bg-white px-3 py-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-[#b8f34a] dark:border-[#324133] dark:bg-[#101a11] dark:text-[#e8f5e0]" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-[#4a6044] dark:text-[#a8c0a4]">Branch *</label>
                        <select value={regBranch} onChange={(e) => setRegBranch(e.target.value)}
                          className="w-full rounded-xl border border-[#dde2d6] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#b8f34a] dark:border-[#324133] dark:bg-[#101a11] dark:text-[#e8f5e0]">
                          <option>Computer Science &amp; Engineering</option>
                          <option>Electronics &amp; Communication</option>
                          <option>Design &amp; Interaction</option>
                          <option>Information Technology</option>
                          <option>Mechanical Engineering</option>
                          <option>Civil Engineering</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-[#4a6044] dark:text-[#a8c0a4]">Year *</label>
                        <select value={regYear} onChange={(e) => setRegYear(e.target.value)}
                          className="w-full rounded-xl border border-[#dde2d6] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#b8f34a] dark:border-[#324133] dark:bg-[#101a11] dark:text-[#e8f5e0]">
                          <option>1st Year</option><option>2nd Year</option><option>3rd Year</option><option>4th Year</option>
                        </select>
                      </div>
                    </div>

                    {/* Email + Mobile inputs + Send OTPs */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-[#4a6044] dark:text-[#a8c0a4]">College Email *</label>
                        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@campus.edu"
                          className="w-full rounded-xl border border-[#dde2d6] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#b8f34a] dark:border-[#324133] dark:bg-[#101a11] dark:text-[#e8f5e0]" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-[#4a6044] dark:text-[#a8c0a4]">Mobile Number *</label>
                        <input required value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+91 98765 43210"
                          className="w-full rounded-xl border border-[#dde2d6] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#b8f34a] dark:border-[#324133] dark:bg-[#101a11] dark:text-[#e8f5e0]" />
                      </div>
                    </div>

                    {!emailOtpSent && (
                      <button type="button" onClick={sendDualOtps} disabled={sendingEmail || !email || !mobile}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#c8e4a0] bg-[#f2fbe6] py-3 text-sm font-bold text-[#5a8820] transition hover:bg-[#e8f8d4] disabled:opacity-50 dark:border-[#426a20] dark:bg-[#1c3014] dark:text-[#a8d870]">
                        {sendingEmail ? <><Spinner /> Sending OTPs…</> : <><Mail size={15} /> Send Verification Codes to Both</>}
                      </button>
                    )}

                    {emailOtpSent && (
                      <div className="space-y-3">
                      <OtpSection
                          label="Email OTP" icon={Mail}
                          hint={`6-digit code sent to ${email}. Check your inbox.`}
                          value={emailOtp} onChange={(v) => { setEmailOtp(v); setEmailOtpError(""); }}
                          onSend={sendDualOtps} sending={sendingEmail} sent={emailOtpSent} cooldown={emailCooldown}
                          verified={emailVerified} error={emailOtpError}
                          onVerify={verifyEmailOtp} verifying={verifyingEmail}
                        />
                        <OtpSection
                          label="Mobile OTP" icon={Smartphone}
                          hint={`6-digit code sent to ${mobile}. Check your phone.`}
                          value={mobileOtp} onChange={(v) => { setMobileOtp(v); setMobileOtpError(""); }}
                          onSend={sendDualOtps} sending={sendingMobile} sent={mobileOtpSent} cooldown={mobileCooldown}
                          verified={mobileVerified} error={mobileOtpError}
                          onVerify={verifyMobileOtp} verifying={verifyingMobile}
                        />
                      </div>
                    )}

                    {bothVerified && (
                      <div className="rounded-2xl border border-[#6abf56] bg-[#f0fced] p-3 dark:border-[#4a9a3c] dark:bg-[#16301a]">
                        <div className="flex items-center gap-2 text-sm font-bold text-[#2a7a20] dark:text-[#a0e080]">
                          <CheckCircle2 size={18} /> Both identities verified! Ready to register.
                        </div>
                      </div>
                    )}

                    <button type="submit" disabled={formLoading || !bothVerified}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#172017] py-3.5 text-sm font-bold text-white shadow-[0_5px_0_#0c110c] transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#b8f34a] dark:text-[#172017] dark:shadow-[0_5px_0_#7eaa2a]">
                      {formLoading ? <><Spinner /> Creating profile…</> : <>Complete Registration <ArrowRight size={15} /></>}
                    </button>

                    <div className="rounded-xl bg-[#f5f9ee] p-2.5 text-[11px] text-[#5a7040] dark:bg-[#1c2e16] dark:text-[#b0cc90]">
                      <ShieldCheck size={12} className="mr-1 inline" />
                      Section is never collected. Only verified campus community members may participate.
                    </div>
                  </form>
                </animated.div>
              )}

              {/* ── RECOVER (Dual OTP) ── */}
              {mode === "recover" && (
                <animated.div style={formAnim}>
                  <form onSubmit={handleRecover} className="space-y-4">
                    <div>
                      <h2 className="font-display text-2xl font-extrabold tracking-[-0.05em] text-[#1a2a1a] dark:text-[#e8f5e0]">
                        Account Recovery
                      </h2>
                      <p className="mt-1 text-xs text-[#8a9a88] dark:text-[#9aaa98]">
                        Dual-factor verification required — both college email and mobile must be verified.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[#f5d796] bg-[#fff8e7] p-3.5 text-xs text-[#8a601e] dark:border-[#5a421b] dark:bg-[#28200f] dark:text-[#f0d090]">
                      <AlertTriangle size={14} className="mr-1.5 inline" />
                      For your security, admin-assisted recovery is not permitted. Both OTPs are mandatory.
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-[#4a6044] dark:text-[#a8c0a4]">College Email *</label>
                        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@campus.edu"
                          className="w-full rounded-xl border border-[#dde2d6] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#b8f34a] dark:border-[#324133] dark:bg-[#101a11] dark:text-[#e8f5e0]" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-[#4a6044] dark:text-[#a8c0a4]">Registered Mobile *</label>
                        <input required value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+91 98765 43210"
                          className="w-full rounded-xl border border-[#dde2d6] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#b8f34a] dark:border-[#324133] dark:bg-[#101a11] dark:text-[#e8f5e0]" />
                      </div>
                    </div>

                    {!emailOtpSent && (
                      <button type="button" onClick={sendDualOtps} disabled={sendingEmail || !email || !mobile}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#c8e4a0] bg-[#f2fbe6] py-3 text-sm font-bold text-[#5a8820] transition hover:bg-[#e8f8d4] disabled:opacity-50 dark:border-[#426a20] dark:bg-[#1c3014] dark:text-[#a8d870]">
                        {sendingEmail ? <><Spinner /> Sending…</> : <><Mail size={15} /> Send Verification Codes</>}
                      </button>
                    )}

                    {emailOtpSent && (
                      <div className="space-y-3">
                        <OtpSection
                          label="Email OTP" icon={Mail}
                          hint={`6-digit code sent to ${email}. Check your inbox.`}
                          value={emailOtp} onChange={(v) => { setEmailOtp(v); setEmailOtpError(""); }}
                          onSend={sendDualOtps} sending={sendingEmail} sent={emailOtpSent} cooldown={emailCooldown}
                          verified={emailVerified} error={emailOtpError}
                          onVerify={verifyEmailOtp} verifying={verifyingEmail}
                        />
                        <OtpSection
                          label="Mobile OTP" icon={Smartphone}
                          hint={`6-digit code sent to ${mobile}. Check your phone.`}
                          value={mobileOtp} onChange={(v) => { setMobileOtp(v); setMobileOtpError(""); }}
                          onSend={sendDualOtps} sending={sendingMobile} sent={mobileOtpSent} cooldown={mobileCooldown}
                          verified={mobileVerified} error={mobileOtpError}
                          onVerify={verifyMobileOtp} verifying={verifyingMobile}
                        />
                      </div>
                    )}

                    {bothVerified && (
                      <div className="rounded-2xl border border-[#6abf56] bg-[#f0fced] p-3 dark:border-[#4a9a3c] dark:bg-[#16301a]">
                        <div className="flex items-center gap-2 text-sm font-bold text-[#2a7a20] dark:text-[#a0e080]">
                          <CheckCircle2 size={18} /> Both verified! Proceeding with account recovery.
                        </div>
                      </div>
                    )}

                    <button type="submit" disabled={formLoading || !bothVerified}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#172017] py-3.5 text-sm font-bold text-white shadow-[0_5px_0_#0c110c] transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#b8f34a] dark:text-[#172017] dark:shadow-[0_5px_0_#7eaa2a]">
                      {formLoading ? <><Spinner /> Recovering…</> : <>Recover My Account <ArrowRight size={15} /></>}
                    </button>
                  </form>
                </animated.div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-[#eaeee4] px-6 py-3.5 dark:border-[#263028]">
              <div className="flex items-center gap-1.5 text-[11px] text-[#9aaa98] dark:text-[#7a8a7a]">
                <LockKeyhole size={12} />
                No biometrics stored. OTPs expire in 10 minutes. Campus Arena Identity Engine.
              </div>
            </div>
          </div>
        </animated.div>
      </div>
    </main>
  );
}
