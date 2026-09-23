// =============================================================================
// Campus Arena — Certificate Printable Page
// Opens in a new tab; user can print/save as PDF via browser print dialog.
// =============================================================================

import { useEffect, useState } from "react";
import { useLocation } from "wouter";

interface CertData {
  id: string;
  competitionId: string;
  userId: string;
  userName: string;
  teamName: string;
  type: "participation" | "finalist" | "winner" | "special_recognition" | "custom";
  title: string;
  subtitle: string;
  issuedDate: string;
  verificationCode: string;
  eligible: boolean;
}

const TYPE_CONFIG: Record<string, { label: string; bg: string; accent: string; text: string }> = {
  winner: {
    label: "WINNER",
    bg: "linear-gradient(135deg, #1a283f 0%, #243552 50%, #2d4268 100%)",
    accent: "#b8f34a",
    text: "#b8f34a",
  },
  finalist: {
    label: "FINALIST",
    bg: "linear-gradient(135deg, #2c1e0e 0%, #3d2a12 50%, #5a3c18 100%)",
    accent: "#f8d070",
    text: "#f8d070",
  },
  participation: {
    label: "PARTICIPATION",
    bg: "linear-gradient(135deg, #172017 0%, #1e2d1e 50%, #253526 100%)",
    accent: "#b8f34a",
    text: "#b8f34a",
  },
  special_recognition: {
    label: "SPECIAL RECOGNITION",
    bg: "linear-gradient(135deg, #1a1040 0%, #251558 50%, #2e1a6a 100%)",
    accent: "#c3b1e1",
    text: "#c3b1e1",
  },
  custom: {
    label: "CERTIFICATE",
    bg: "linear-gradient(135deg, #0d1f17 0%, #142619 50%, #1e3422 100%)",
    accent: "#b8f34a",
    text: "#b8f34a",
  },
};

export default function CertificatePage() {
  const [location] = useLocation();
  const [cert, setCert] = useState<CertData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Parse cert ID from URL: /certificate/:certId
  const certId = location.replace("/certificate/", "").split("?")[0];

  useEffect(() => {
    if (!certId || certId === "/certificate") {
      setError("No certificate ID provided.");
      setLoading(false);
      return;
    }

    // Try to load from current user's certificates
    // First check if userId is in query params
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("userId");
    if (!userId) {
      setError("User ID is required to view this certificate.");
      setLoading(false);
      return;
    }

    fetch(`/api/users/${userId}/certificates`)
      .then((r) => r.json())
      .then((d) => {
        const found = (d.certificates ?? []).find((c: CertData) => c.id === certId);
        if (!found) {
          setError("Certificate not found or you do not have access to it.");
        } else if (!found.eligible) {
          setError("You are not yet eligible to download this certificate. Please check your attendance and round requirements.");
        } else {
          setCert(found);
          // Auto-trigger print dialog after render
          setTimeout(() => window.print(), 800);
        }
      })
      .catch(() => setError("Could not load certificate. Please try again."))
      .finally(() => setLoading(false));
  }, [certId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f8f4]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#b8f34a] border-t-transparent" />
          <p className="mt-4 text-sm font-bold text-[#6c7a6c]">Loading certificate…</p>
        </div>
      </div>
    );
  }

  if (error || !cert) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f8f4] p-6">
        <div className="max-w-md rounded-2xl border border-[#e1e0da] bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#fff0ef] text-[#bf5b5d]">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="font-display text-xl font-extrabold tracking-[-0.04em] text-[#2d3a2d]">Certificate unavailable</h1>
          <p className="mt-2 text-sm text-[#7d897c]">{error ?? "Certificate not found."}</p>
          <button onClick={() => window.close()} className="mt-6 rounded-xl bg-[#172017] px-4 py-2 text-sm font-bold text-white">
            Close
          </button>
        </div>
      </div>
    );
  }

  const config = TYPE_CONFIG[cert.type] ?? TYPE_CONFIG.participation;
  const issued = cert.issuedDate ? new Date(cert.issuedDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f0f2ec; font-family: 'Outfit', sans-serif; }
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .cert-page { box-shadow: none !important; margin: 0 !important; }
        }
      `}</style>

      {/* Print / Download button — hidden during print */}
      <div className="no-print flex items-center justify-center gap-3 py-6">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#172017] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5"
        >
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download / Print PDF
        </button>
        <button onClick={() => window.close()} className="rounded-xl border border-[#dfe4d8] bg-white px-5 py-2.5 text-sm font-bold text-[#6b7269] transition hover:bg-[#f5f5f0]">
          Close
        </button>
      </div>

      {/* Certificate card */}
      <div
        className="cert-page mx-auto mb-12 flex h-[620px] w-[900px] flex-col justify-between overflow-hidden rounded-3xl shadow-[0_40px_80px_rgba(0,0,0,.25)]"
        style={{ background: config.bg }}
      >
        {/* Top decorative elements */}
        <div className="relative flex-1 p-10">
          {/* Decorative circles */}
          <div
            style={{ background: config.accent, opacity: 0.08 }}
            className="absolute -right-20 -top-20 h-[340px] w-[340px] rounded-full"
          />
          <div
            style={{ border: `28px solid ${config.accent}`, opacity: 0.06 }}
            className="absolute -bottom-32 -left-20 h-[300px] w-[300px] rounded-full"
          />

          {/* Header row */}
          <div className="relative flex items-start justify-between">
            <div>
              <div
                style={{ color: config.text, borderColor: `${config.text}30`, background: `${config.text}12` }}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold tracking-[0.2em] uppercase"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <circle cx="5" cy="5" r="5" opacity="0.6" />
                </svg>
                Campus Arena
              </div>
              <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">
                This certifies that
              </div>
            </div>
            <div style={{ color: config.text }} className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Certificate type</div>
              <div className="mt-1 text-lg font-black tracking-[0.08em]" style={{ color: config.text }}>
                {config.label}
              </div>
            </div>
          </div>

          {/* Recipient name */}
          <div className="relative mt-5">
            <h1
              className="font-display text-[52px] font-extrabold leading-none tracking-[-0.05em] text-white"
            >
              {cert.userName}
            </h1>
            {cert.teamName && cert.teamName !== "Solo" && (
              <div className="mt-2 text-sm font-semibold text-white/50">
                Team: <span className="text-white/75">{cert.teamName}</span>
              </div>
            )}
          </div>

          {/* Achievement text */}
          <div className="relative mt-8">
            <p className="max-w-[520px] text-sm leading-7 text-white/65">
              {cert.type === "winner"
                ? `has demonstrated exceptional skill and creativity, achieving first place in`
                : cert.type === "finalist"
                ? `has been recognised as a finalist, demonstrating exceptional skill and creativity in`
                : cert.type === "special_recognition"
                ? `has been awarded special recognition for outstanding contribution to`
                : `has successfully participated in`}
            </p>
            <div className="mt-2 font-display text-2xl font-extrabold tracking-[-0.04em] text-white">
              {cert.title}
            </div>
            {cert.subtitle && (
              <div className="mt-1 text-sm text-white/50">{cert.subtitle}</div>
            )}
          </div>
        </div>

        {/* Footer strip */}
        <div
          style={{ background: "rgba(255,255,255,0.06)", borderTop: "1px solid rgba(255,255,255,0.1)" }}
          className="relative flex items-center justify-between px-10 py-5"
        >
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Issued</div>
            <div className="mt-1 text-sm font-bold text-white/70">{issued}</div>
          </div>
          <div className="text-center">
            {/* Decorative underline signature area */}
            <div className="mb-2 h-px w-32 bg-white/20 mx-auto" />
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Platform administrator</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Verification code</div>
            <div className="mt-1 font-mono text-sm font-bold tracking-wider" style={{ color: config.text }}>
              {cert.verificationCode}
            </div>
          </div>
        </div>
      </div>

      <p className="no-print pb-8 text-center text-xs text-[#a0a89e]">
        Verify this certificate at campusarena.edu/verify/{cert.verificationCode}
      </p>
    </>
  );
}
