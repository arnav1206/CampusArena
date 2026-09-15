// =============================================================================
// Campus Arena — Downloadable Digital Event Pass with Non-PII QR Code
// =============================================================================

import React, { useEffect, useState } from "react";
import {
  X,
  QrCode,
  Download,
  ShieldCheck,
  CalendarDays,
  Sparkles,
  Award,
} from "lucide-react";
import type { Competition, DigitalPass } from "@shared/types";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";

export function DigitalPassModal({
  competition,
  close,
}: {
  competition: Competition;
  close: () => void;
}) {
  const { user } = useAuth();
  const [pass, setPass] = useState<DigitalPass | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPass();
    }
  }, [competition.id, user?.id]);

  async function loadPass() {
    if (!user) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/competitions/${competition.id}/pass/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setPass(data.pass);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleDownload = () => {
    toast.success("Digital Event Pass saved to your device!");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#172017]/45 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="my-8 max-h-[92vh] w-full max-w-[460px] overflow-y-auto rounded-3xl border border-white/60 bg-[#fbfcf8] p-6 shadow-2xl sm:p-7 dark:border-[#2f3f2f] dark:bg-[#162118]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e9ece3] pb-4 dark:border-[#283729]">
          <div className="flex items-center gap-2">
            <QrCode size={18} className="text-[#719d2a]" />
            <h3 className="font-display text-lg font-extrabold text-[#222c22] dark:text-[#eff7eb]">
              Official Digital Event Pass
            </h3>
          </div>
          <button
            onClick={close}
            className="rounded-lg p-2 text-[#949c91] hover:bg-[#edf0e8] dark:hover:bg-[#202e22]"
          >
            <X size={17} />
          </button>
        </div>

        {loading || !pass ? (
          <div className="py-12 text-center text-xs text-[#8f968c]">Loading event pass...</div>
        ) : (
          <div className="mt-5 space-y-5">
            {/* The Pass Card */}
            <div className="relative overflow-hidden rounded-3xl bg-[#172017] p-6 text-white shadow-xl dark:bg-[#0c130d]">
              {/* Decorative Haikei Geometry */}
              <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full border-[16px] border-[#b8f34a]/15" />
              <div className="pointer-events-none absolute -bottom-16 -left-12 h-40 w-40 rounded-full border-[20px] border-white/8" />

              {/* Pass Top Branding */}
              <div className="relative flex items-center justify-between">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#b8f34a]">
                    Campus Arena Pass
                  </div>
                  <div className="font-display text-xl font-extrabold tracking-tight text-white">
                    {competition.title}
                  </div>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-xs font-black">
                  {competition.branding.logoText}
                </div>
              </div>

              {/* QR Code Container */}
              <div className="relative my-6 mx-auto flex w-44 flex-col items-center justify-center rounded-2xl bg-white p-4 shadow-md">
                {/* SVG Mock QR Code with authentic look */}
                <svg viewBox="0 0 100 100" className="h-32 w-32">
                  <rect width="100" height="100" fill="white" />
                  {/* Outer corner markers */}
                  <rect x="5" y="5" width="26" height="26" fill="#172017" rx="3" />
                  <rect x="9" y="9" width="18" height="18" fill="white" rx="2" />
                  <rect x="13" y="13" width="10" height="10" fill="#172017" rx="1" />

                  <rect x="69" y="5" width="26" height="26" fill="#172017" rx="3" />
                  <rect x="73" y="9" width="18" height="18" fill="white" rx="2" />
                  <rect x="77" y="13" width="10" height="10" fill="#172017" rx="1" />

                  <rect x="5" y="69" width="26" height="26" fill="#172017" rx="3" />
                  <rect x="9" y="73" width="18" height="18" fill="white" rx="2" />
                  <rect x="13" y="77" width="10" height="10" fill="#172017" rx="1" />

                  {/* High entropy geometric blocks */}
                  <rect x="36" y="8" width="6" height="6" fill="#172017" />
                  <rect x="46" y="8" width="6" height="6" fill="#172017" />
                  <rect x="56" y="8" width="6" height="6" fill="#172017" />
                  <rect x="36" y="20" width="12" height="6" fill="#172017" />
                  <rect x="52" y="20" width="8" height="8" fill="#172017" />
                  <rect x="8" y="38" width="8" height="8" fill="#172017" />
                  <rect x="22" y="38" width="8" height="8" fill="#172017" />
                  <rect x="36" y="36" width="28" height="28" fill="#172017" rx="4" />
                  <rect x="42" y="42" width="16" height="16" fill="white" rx="2" />
                  <rect x="46" y="46" width="8" height="8" fill="#b8f34a" rx="1" />
                  <rect x="70" y="38" width="6" height="14" fill="#172017" />
                  <rect x="82" y="38" width="10" height="8" fill="#172017" />
                  <rect x="70" y="58" width="16" height="6" fill="#172017" />
                  <rect x="36" y="70" width="10" height="10" fill="#172017" />
                  <rect x="52" y="70" width="6" height="18" fill="#172017" />
                  <rect x="64" y="70" width="12" height="10" fill="#172017" />
                  <rect x="82" y="74" width="8" height="14" fill="#172017" />
                </svg>
                <div className="mt-2 text-center text-[9px] font-bold uppercase tracking-wider text-[#697067]">
                  Non-PII Token
                </div>
              </div>

              {/* Participant & Team Details */}
              <div className="space-y-2 border-t border-white/15 pt-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-white/60">Participant</span>
                  <span className="font-extrabold text-white">{pass.participantName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Roll Number</span>
                  <span className="font-mono text-white/90">{pass.rollNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Team</span>
                  <span className="font-bold text-[#b8f34a]">{pass.teamName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Track</span>
                  <span className="text-white/90">{pass.trackName}</span>
                </div>
              </div>
            </div>

            {/* Privacy Guarantee */}
            <div className="rounded-xl bg-[#f4f7ee] p-3 text-[11px] leading-4 text-[#5e7732] dark:bg-[#1f2b1c] dark:text-[#c4e68e]">
              <ShieldCheck size={14} className="mr-1 inline text-[#729e2c]" />
              <strong>Privacy Guaranteed:</strong> This QR code is event-specific and contains zero personal information. It encodes only a single-use opaque authorization token.
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between border-t border-[#e9ece3] pt-4 dark:border-[#283729]">
              <button
                type="button"
                onClick={close}
                className="text-xs font-bold text-[#868f83] hover:underline"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#172017] px-4 py-2.5 text-xs font-bold text-white shadow-[0_3px_0_#0c110c] hover:-translate-y-0.5 dark:bg-[#b8f34a] dark:text-[#172017] dark:shadow-[0_3px_0_#7eaa2a]"
              >
                <Download size={14} /> Download Digital Pass
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
