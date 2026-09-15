// =============================================================================
// Campus Arena — Completed Competition Public Showcase & Anonymous Feedback
// =============================================================================

import React, { useEffect, useState } from "react";
import {
  X,
  Trophy,
  Award,
  Users,
  Sparkles,
  MessageSquare,
  Send,
  Star,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import type { Competition, CompetitionReview } from "@shared/types";
import { toast } from "sonner";

export function ShowcaseModal({
  competition,
  close,
}: {
  competition: Competition;
  close: () => void;
}) {
  const [reviews, setReviews] = useState<CompetitionReview[]>([]);
  const [rating, setRating] = useState(5);
  const [positives, setPositives] = useState("");
  const [improvements, setImprovements] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, [competition.id]);

  async function fetchReviews() {
    try {
      const res = await fetch(`/api/competitions/${competition.id}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
      }
    } catch (err) {
      console.error(err);
    }
  }

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingFeedback(true);
    try {
      const res = await fetch(`/api/competitions/${competition.id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, positives, improvements }),
      });
      if (res.ok) {
        toast.success("Feedback submitted anonymously. Thank you!");
        setPositives("");
        setImprovements("");
        fetchReviews();
      }
    } catch {
      toast.error("Failed to submit feedback");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#172017]/45 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="my-8 max-h-[92vh] w-full max-w-[720px] overflow-y-auto rounded-3xl border border-white/60 bg-[#fbfcf8] p-6 shadow-2xl sm:p-8 dark:border-[#2f3f2f] dark:bg-[#162118]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#e9ece3] pb-5 dark:border-[#283729]">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#b8f34a] text-[#172017] shadow-[0_3px_0_#7eaa2a]">
              <Trophy size={20} strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#719d2a]">
                Public Event Showcase
              </div>
              <h2 className="font-display text-2xl font-extrabold tracking-[-0.05em] text-[#222c22] dark:text-[#eff7eb]">
                {competition.title} · Hall of Fame
              </h2>
            </div>
          </div>
          <button
            onClick={close}
            className="rounded-lg p-2 text-[#949c91] hover:bg-[#edf0e8] dark:hover:bg-[#202e22]"
          >
            <X size={19} />
          </button>
        </div>

        <div className="mt-6 space-y-6">
          {/* Winners Showcase Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="relative overflow-hidden rounded-2xl bg-[#172017] p-5 text-white shadow-lg dark:bg-[#0c130d]">
              <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border-[14px] border-[#b8f34a]/15" />
              <div className="relative flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b8f34a]">
                  1st Place Winner
                </span>
                <Trophy size={18} className="text-[#b8f34a]" />
              </div>
              <div className="mt-4 font-display text-2xl font-extrabold">Greenroom</div>
              <div className="mt-1 text-xs text-white/70">
                Sustainable Campus IoT & Food Surplus Redistribution Network
              </div>
              <div className="mt-4 border-t border-white/10 pt-3 text-[11px] text-white/60">
                Civic Tech Track · Awarded ₹25,000 grant
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-[#f7f2e4] p-5 text-[#423420] shadow-md dark:bg-[#261f14] dark:text-[#eedfca]">
              <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border-[14px] border-[#d8ad59]/20" />
              <div className="relative flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b17a22]">
                  Finalist Runner-Up
                </span>
                <Award size={18} className="text-[#b17a22]" />
              </div>
              <div className="mt-4 font-display text-2xl font-extrabold">Ctrl + Alt + Elite</div>
              <div className="mt-1 text-xs text-[#705e46] dark:text-[#d3c0a8]">
                Offline-First Micro-Savings Ledger for Student Co-operatives
              </div>
              <div className="mt-4 border-t border-[#dfd5bf] pt-3 text-[11px] text-[#86735a] dark:border-[#403320] dark:text-[#b8a38b]">
                FinTech Track · Top 5 Finalist
              </div>
            </div>
          </div>

          {/* Anonymous Participant Reviews Section */}
          <div className="rounded-2xl border border-[#e2e6dc] bg-white p-5 shadow-sm dark:border-[#2b3a2d] dark:bg-[#1a251c]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-[#293529] dark:text-[#eff7eb]">
                  Anonymous Participant Reviews
                </h3>
                <p className="mt-0.5 text-xs text-[#8d9489] dark:text-[#9ea99b]">
                  Public reviews are completely anonymous. Feedback is optional and{" "}
                  <strong>never</strong> blocks certificate downloads.
                </p>
              </div>
              <span className="rounded-full bg-[#f0f3eb] px-2.5 py-1 text-[10px] font-bold text-[#687265] dark:bg-[#253325] dark:text-[#c4d4c2]">
                {reviews.length} reviews
              </span>
            </div>

            {/* Existing Reviews */}
            <div className="mt-4 space-y-3">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="rounded-xl border border-[#edf0e8] bg-[#fbfcf8] p-3.5 text-xs dark:border-[#2d3b2e] dark:bg-[#141f15]"
                >
                  <div className="flex items-center gap-1 text-[#e19b26]">
                    {Array.from({ length: rev.rating }).map((_, i) => (
                      <Star key={i} size={12} fill="currentColor" />
                    ))}
                    <span className="ml-2 text-[10px] font-bold text-[#868e83]">
                      Verified Participant
                    </span>
                  </div>
                  {rev.positives && (
                    <p className="mt-1.5 font-semibold text-[#324032] dark:text-[#d5e4d2]">
                      "{rev.positives}"
                    </p>
                  )}
                  {rev.improvements && (
                    <p className="mt-1 text-[11px] text-[#889084] dark:text-[#9aa798]">
                      <strong>What could be improved:</strong> {rev.improvements}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Optional Anonymous Feedback Composer */}
            <form
              onSubmit={handleFeedbackSubmit}
              className="mt-5 border-t border-[#edf0e8] pt-4 space-y-3 dark:border-[#29382b]"
            >
              <div className="text-xs font-bold text-[#455244] dark:text-[#c3d1c1]">
                Leave Anonymous Participant Feedback (Optional)
              </div>

              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setRating(num)}
                    className="p-1 text-[#e19b26]"
                  >
                    <Star
                      size={18}
                      fill={num <= rating ? "currentColor" : "none"}
                      stroke="currentColor"
                    />
                  </button>
                ))}
              </div>

              <input
                value={positives}
                onChange={(e) => setPositives(e.target.value)}
                placeholder="What went well? (e.g. mentor feedback was world-class)"
                className="w-full rounded-xl border border-[#dfe4d8] bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#b8f34a] dark:border-[#334234] dark:bg-[#131d14] dark:text-[#eaf5e8]"
              />

              <input
                value={improvements}
                onChange={(e) => setImprovements(e.target.value)}
                placeholder="What could be improved next time?"
                className="w-full rounded-xl border border-[#dfe4d8] bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#b8f34a] dark:border-[#334234] dark:bg-[#131d14] dark:text-[#eaf5e8]"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submittingFeedback || (!positives && !improvements)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#172017] px-4 py-2 text-xs font-bold text-white shadow-sm hover:-translate-y-0.5 dark:bg-[#b8f34a] dark:text-[#172017]"
                >
                  <Send size={12} /> Post Anonymous Feedback
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
