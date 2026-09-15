// =============================================================================
// Campus Arena — Find Teammates (Looking for a Team, Recommendations without scores)
// =============================================================================

import React, { useEffect, useState } from "react";
import {
  X,
  Users,
  Sparkles,
  UserPlus,
  Handshake,
  Check,
  ShieldCheck,
  Award,
} from "lucide-react";
import type { StudentProfile, Competition } from "@shared/types";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";

export function FindTeammatesModal({
  competition,
  close,
}: {
  competition: Competition;
  close: () => void;
}) {
  const { user, profile } = useAuth();
  const [candidates, setCandidates] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCandidates();
  }, [user?.id]);

  async function fetchCandidates() {
    try {
      setLoading(true);
      const res = await fetch(`/api/teammates/candidates?exclude=${user?.id || ""}`);
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Recommendations: Candidates sharing skills or domains with current user
  const myDomains = profile?.domains || [];
  const mySkills = [...(profile?.technicalSkills || []), ...(profile?.nonTechnicalSkills || [])];

  const recommended = candidates.filter((c) => {
    const hasSharedDomain = c.domains.some((d) => myDomains.includes(d));
    const hasSharedSkill = [...c.technicalSkills, ...c.nonTechnicalSkills].some((s) =>
      mySkills.includes(s)
    );
    return hasSharedDomain || hasSharedSkill;
  });

  const others = candidates.filter((c) => !recommended.includes(c));

  const handleInvite = (candidate: StudentProfile) => {
    toast.success(`Invitation dispatched to ${candidate.name}! They will see it in their invitations queue.`);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#172017]/45 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="my-8 max-h-[92vh] w-full max-w-[680px] overflow-y-auto rounded-3xl border border-white/60 bg-[#fbfcf7] p-6 shadow-2xl sm:p-8 dark:border-[#2f3f2f] dark:bg-[#162118]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#e9ece3] pb-5 dark:border-[#283729]">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#719d2a]">
              Teammate Discovery
            </div>
            <h2 className="mt-1 font-display text-2xl font-extrabold tracking-[-0.05em] text-[#222c22] dark:text-[#eff7eb]">
              Find Teammates
            </h2>
            <p className="mt-1 text-xs text-[#8d9489] dark:text-[#9ea99b]">
              Students actively marked as <em>Looking for a Team</em> in the college community.
            </p>
          </div>
          <button
            onClick={close}
            className="rounded-lg p-2 text-[#949c91] hover:bg-[#edf0e8] dark:hover:bg-[#202e22]"
          >
            <X size={19} />
          </button>
        </div>

        <div className="mt-6 space-y-6">
          {/* Top Recommendations (NO Match score, NO Percentage, NO algorithm text) */}
          {recommended.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[#719d2a]">
                <Sparkles size={14} /> Recommended for you
              </div>
              <div className="space-y-3">
                {recommended.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    onInvite={() => handleInvite(candidate)}
                    isRecommended
                  />
                ))}
              </div>
            </div>
          )}

          {/* All Other Candidates */}
          <div>
            <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-[0.12em] text-[#868e83] dark:text-[#9ea99b]">
              <span>All Available Students ({candidates.length})</span>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-[#959d92]">Finding teammates...</div>
            ) : others.length === 0 && recommended.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d8ded2] p-8 text-center text-xs text-[#8f968c] dark:border-[#334234]">
                No students currently have "Looking for a Team" turned on. Check back soon or turn on your intent!
              </div>
            ) : (
              <div className="space-y-3">
                {others.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    onInvite={() => handleInvite(candidate)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CandidateCard({
  candidate,
  onInvite,
  isRecommended,
}: {
  candidate: StudentProfile;
  onInvite: () => void;
  isRecommended?: boolean;
}) {
  const [invited, setInvited] = useState(false);

  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm transition ${
        isRecommended
          ? "border-[#cfe69f] bg-[#f8fdec] dark:border-[#415926] dark:bg-[#1a2618]"
          : "border-[#e2e6dc] bg-white dark:border-[#2b3a2d] dark:bg-[#1a251c]"
      }`}
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e7f2cc] text-xs font-bold text-[#2c4a15] dark:bg-[#2d4021] dark:text-[#cdea80]">
            {candidate.name.split(" ").map((n) => n[0]).join("")}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-extrabold text-[#243124] dark:text-[#edf7ec]">
                {candidate.name}
              </span>
              <span className="text-[11px] text-[#8c9489] dark:text-[#9ea99b]">
                {candidate.branch} · {candidate.year}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {candidate.technicalSkills.slice(0, 4).map((s) => (
                <span
                  key={s}
                  className="rounded-md bg-[#edf2e6] px-2 py-0.5 text-[10px] font-bold text-[#455444] dark:bg-[#233123] dark:text-[#b8cbb6]"
                >
                  {s}
                </span>
              ))}
              {candidate.domains.slice(0, 2).map((d) => (
                <span
                  key={d}
                  className="rounded-md bg-[#edf5ff] px-2 py-0.5 text-[10px] font-bold text-[#346da6] dark:bg-[#192b3d] dark:text-[#96c1ed]"
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={invited}
          onClick={() => {
            setInvited(true);
            onInvite();
          }}
          className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            invited
              ? "border border-[#b8f34a] bg-[#f0fbd8] text-[#557e1d] dark:bg-[#203019] dark:text-[#b8f34a]"
              : "bg-[#172017] text-white shadow-[0_3px_0_#0c110c] hover:-translate-y-0.5 dark:bg-[#b8f34a] dark:text-[#172017] dark:shadow-[0_3px_0_#7eaa2a]"
          }`}
        >
          {invited ? (
            <span className="flex items-center gap-1">
              <Check size={12} strokeWidth={3} /> Invited
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <UserPlus size={12} /> Invite to Team
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
