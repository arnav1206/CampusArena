// =============================================================================
// Campus Arena — Find a Team Modal (No team-name search; browsing & code request)
// =============================================================================

import React, { useEffect, useState } from "react";
import {
  X,
  Users,
  Search,
  KeyRound,
  ChevronRight,
  ShieldCheck,
  Check,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import type { Team, Competition } from "@shared/types";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";

export function FindTeamModal({
  competition,
  close,
  onTeamJoined,
}: {
  competition: Competition;
  close: () => void;
  onTeamJoined?: () => void;
}) {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamCode, setTeamCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [submittingCode, setSubmittingCode] = useState(false);

  useEffect(() => {
    fetchTeams();
  }, [competition.id]);

  async function fetchTeams() {
    try {
      setLoading(true);
      const res = await fetch(`/api/competitions/${competition.id}/teams`);
      if (res.ok) {
        const data = await res.json();
        // Filter teams that have space and are not withdrawn
        setTeams(data.teams || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleJoinByCode = async () => {
    if (!teamCode.trim() || !user) return;
    setSubmittingCode(true);
    try {
      const res = await fetch("/api/teams/join-by-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamCode, userId: user.id }),
      });
      const data = await res.json();
      setSubmittingCode(false);
      if (res.ok && data.success) {
        toast.success(data.message);
        setTeamCode("");
        close();
        if (onTeamJoined) onTeamJoined();
      } else {
        toast.error(data.error || "Failed to submit team join request.");
      }
    } catch (err: any) {
      setSubmittingCode(false);
      toast.error(err.message || "Network error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#172017]/45 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="my-8 max-h-[92vh] w-full max-w-[620px] overflow-y-auto rounded-3xl border border-white/60 bg-[#fbfcf7] p-6 shadow-2xl sm:p-8 dark:border-[#2f3f2f] dark:bg-[#162118]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#e9ece3] pb-5 dark:border-[#283729]">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#719d2a]">
              Team Formation Room
            </div>
            <h2 className="mt-1 font-display text-2xl font-extrabold tracking-[-0.05em] text-[#222c22] dark:text-[#eff7eb]">
              Find an Existing Team
            </h2>
            <p className="mt-1 text-xs text-[#8d9489] dark:text-[#9ea99b]">
              Browse teams with open slots, or enter a team code to request joining.
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
          {/* Team Code Entry Section */}
          <div className="rounded-2xl border border-[#d8ded2] bg-white p-4 shadow-sm dark:border-[#2a382c] dark:bg-[#1a251c]">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#323d32] dark:text-[#e4efe2]">
              <KeyRound size={15} className="text-[#719d2a]" /> Have a permanent Team Code?
            </div>
            <p className="mt-1 text-[11px] leading-4 text-[#8a9287] dark:text-[#9ea99b]">
              <strong>Rule:</strong> Entering a team code sends a request to the Team Leader. Team code alone NEVER adds you automatically.
            </p>

            <div className="mt-3 flex gap-2">
              <input
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                placeholder="e.g. CA-4091"
                className="w-full rounded-xl border border-[#dfe4d8] bg-[#fbfcf8] px-3.5 py-2.5 font-mono text-sm uppercase tracking-wider outline-none focus:ring-2 focus:ring-[#b8f34a] dark:border-[#334234] dark:bg-[#111a12] dark:text-[#eaf5e8]"
              />
              <button
                type="button"
                disabled={submittingCode || !teamCode.trim()}
                onClick={handleJoinByCode}
                className="shrink-0 rounded-xl bg-[#172017] px-4 py-2.5 text-xs font-bold text-white shadow-[0_3px_0_#0c110c] transition hover:-translate-y-0.5 active:translate-y-0 dark:bg-[#b8f34a] dark:text-[#172017] dark:shadow-[0_3px_0_#7eaa2a]"
              >
                {submittingCode ? "Requesting..." : "Send Request"}
              </button>
            </div>
          </div>

          {/* Teams Directory (Note: Prompt explicitly specifies NO team-name search for students) */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#868e83] dark:text-[#9ea99b]">
                Open Teams in {competition.title}
              </span>
              <span className="text-[11px] font-semibold text-[#719d2a]">
                {teams.length} teams listed
              </span>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-[#959d92]">Loading teams...</div>
            ) : teams.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d8ded2] p-8 text-center text-xs text-[#8f968c] dark:border-[#334234]">
                No open teams are currently accepting join requests. You can create a new team or register individually!
              </div>
            ) : (
              <div className="space-y-3">
                {teams.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-col justify-between gap-3 rounded-2xl border border-[#e2e6dc] bg-white p-4 shadow-sm transition hover:border-[#b8f34a] sm:flex-row sm:items-center dark:border-[#2b3a2d] dark:bg-[#1a251c]"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-extrabold text-[#2a362a] dark:text-[#edf7ec]">
                          {t.name}
                        </span>
                        <span className="rounded-full bg-[#f1f3ec] px-2 py-0.5 text-[9px] font-bold uppercase text-[#6f786d] dark:bg-[#283729] dark:text-[#bac8b8]">
                          {t.joinMode === "open" ? "Open Requests" : "Approval Req"}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-[#8c9489] dark:text-[#9aa798]">
                        Capacity: Up to {t.maxSize} members · Status: {t.status.replace("_", " ")}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!user) return;
                        const res = await fetch("/api/teams/join-by-code", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ teamCode: t.code, userId: user.id }),
                        });
                        const data = await res.json();
                        if (res.ok && data.success) {
                          toast.success(data.message);
                        } else {
                          toast.error(data.error || "Join request failed");
                        }
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#d8ded2] bg-[#fbfcf8] px-3.5 py-2 text-xs font-bold text-[#324032] shadow-sm hover:bg-[#eef2e6] dark:border-[#384839] dark:bg-[#202c21] dark:text-[#d3dfd1]"
                    >
                      Request to Join <ArrowRight size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
