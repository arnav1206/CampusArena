// =============================================================================
// Campus Arena — Dedicated Judge Evaluation Portal
// =============================================================================

import React, { useEffect, useState } from "react";
import {
  Gavel,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock3,
  FileText,
  ExternalLink,
  Award,
  Sparkles,
  Save,
  Send,
  Flag,
  LogOut,
} from "lucide-react";
import { useLocation } from "wouter";
import type { JudgeAssignment, Submission, JudgingCriteria } from "@shared/types";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";

export function JudgePortal() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [criteria, setCriteria] = useState<JudgingCriteria[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadAssignments();
    }
  }, [user?.id]);

  async function loadAssignments() {
    if (!user) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/judges/${user.id}/assignments`);
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments || []);
        if (data.assignments?.length > 0 && !selectedAssignment) {
          selectAssignment(data.assignments[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function selectAssignment(item: any) {
    setSelectedAssignment(item);
    try {
      const res = await fetch(`/api/rounds/${item.assignment.roundId}/criteria`);
      if (res.ok) {
        const data = await res.json();
        setCriteria(data.criteria || []);
        // Initialize default scores
        const initial: Record<string, number> = {};
        (data.criteria || []).forEach((c: JudgingCriteria) => {
          initial[c.id] = Math.round(c.maxScore * 0.8);
        });
        setScores(initial);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Calculate live weighted score
  const totalWeighted = criteria.reduce((sum, c) => {
    const raw = scores[c.id] || 0;
    return sum + (raw / c.maxScore) * c.weight;
  }, 0);

  const handleScoreChange = (criteriaId: string, val: number) => {
    setScores((prev) => ({ ...prev, [criteriaId]: val }));
  };

  const handleSaveDraft = async () => {
    if (!selectedAssignment || !user) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/judging/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: selectedAssignment.assignment.id,
          judgeUserId: user.id,
          scores,
          comments,
          isDraft: true,
        }),
      });
      if (res.ok) {
        toast.success("Draft evaluation saved successfully.");
        loadAssignments();
      }
    } catch {
      toast.error("Failed to save draft");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitEvaluation = async () => {
    if (!selectedAssignment || !user) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/judging/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: selectedAssignment.assignment.id,
          judgeUserId: user.id,
          scores,
          comments,
          isDraft: false,
        }),
      });
      if (res.ok) {
        toast.success("Evaluation submitted and locked.");
        loadAssignments();
      }
    } catch {
      toast.error("Failed to submit evaluation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConflict = async () => {
    if (!selectedAssignment || !user) return;
    const reason = window.prompt("Reason for conflict of interest (e.g. advisee or related project):");
    if (!reason) return;

    try {
      const res = await fetch("/api/judging/conflict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: selectedAssignment.assignment.id,
          judgeUserId: user.id,
          reason,
        }),
      });
      if (res.ok) {
        toast.info("Conflict of interest recorded. Assignment re-routed.");
        loadAssignments();
      }
    } catch {
      toast.error("Failed to record conflict");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="relative overflow-hidden rounded-[24px] bg-[#172017] p-6 text-white shadow-[0_18px_40px_rgba(31,45,28,.14)] sm:p-8 dark:bg-[#0c130d]">
        <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full border-[46px] border-[#b8f34a]/12" />
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#d9ebbb]">
              <Gavel size={13} className="text-[#b8f34a]" /> Evaluation & Scoring Chamber
            </div>
            <h1 className="font-display text-[36px] font-extrabold leading-[.96] tracking-[-0.07em] sm:text-[46px]">
              Evaluate with rigor.<br />
              <span className="text-[#b8f34a]">Elevate true signal.</span>
            </h1>
            <p className="mt-3 max-w-[540px] text-sm leading-6 text-white/65">
              Review assigned project proposals, verify architectural soundness, and score against weighted rubrics.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                Assignments Queue
              </div>
              <div className="mt-2 font-display text-2xl font-extrabold text-[#b8f34a]">
                {assignments.length} Projects
              </div>
              <div className="mt-1 text-xs text-white/60">Assigned exclusively to you</div>
            </div>
            <button onClick={() => { logout(); setLocation("/login"); }} aria-label="Sign out" className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-white/20">
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </section>

      {/* Main Workspace Layout */}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Left: Assigned Projects Queue */}
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#868f83] dark:text-[#9ea99b]">
            Assigned Submissions ({assignments.length})
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-[#8f968c]">Loading assignments...</div>
          ) : assignments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d8ded2] p-8 text-center text-xs text-[#8f968c] dark:border-[#2d3a2e]">
              No submissions currently assigned for evaluation.
            </div>
          ) : (
            assignments.map((item) => {
              const active = selectedAssignment?.assignment.id === item.assignment.id;
              return (
                <button
                  key={item.assignment.id}
                  onClick={() => selectAssignment(item)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    active
                      ? "border-[#172017] bg-[#172017] text-white shadow-md dark:border-[#b8f34a] dark:bg-[#202e21]"
                      : "border-[#e2e6dc] bg-white text-[#2a362a] hover:border-[#b8f34a] dark:border-[#2b3a2d] dark:bg-[#1a251c] dark:text-[#edf7ec]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                      {item.roundName}
                    </span>
                    {item.isBlind && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold">
                        Blind Review
                      </span>
                    )}
                  </div>
                  <div className="mt-2 font-display text-sm font-extrabold">
                    {item.teamName}
                  </div>
                  <div className="mt-1 text-xs opacity-75 line-clamp-1">
                    {item.submission?.title || "Concept Architecture Note"}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-[10px] font-semibold">
                    <span className="capitalize">{item.assignment.status.replace("_", " ")}</span>
                    <span>Evaluation Active</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right: Rubric & Scoring Card */}
        {selectedAssignment ? (
          <div className="space-y-6">
            {/* Project Overview Card */}
            <div className="rounded-2xl border border-[#e2e6dc] bg-white p-6 shadow-sm dark:border-[#2b3a2d] dark:bg-[#1a251c]">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#719d2a]">
                      {selectedAssignment.roundName}
                    </span>
                    {selectedAssignment.isBlind && (
                      <span className="rounded-full bg-[#f1f3ec] px-2 py-0.5 text-[9px] font-bold text-[#687265] dark:bg-[#293829] dark:text-[#b8cbb6]">
                        Blind Mode Enabled
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1 font-display text-2xl font-extrabold text-[#222c22] dark:text-[#eff7eb]">
                    {selectedAssignment.submission?.title || "Concept Submission"}
                  </h2>
                  <div className="mt-1 text-xs text-[#899187] dark:text-[#9da99a]">
                    Team: <strong>{selectedAssignment.teamName}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleConflict}
                  className="inline-flex items-center gap-1 rounded-xl border border-[#f3c6c7] bg-[#fff6f6] px-3 py-1.5 text-xs font-bold text-[#b53a3c] transition hover:bg-[#ffebeb] dark:border-[#4d2426] dark:bg-[#251516] dark:text-[#f38c8e]"
                >
                  <Flag size={13} /> Declare Conflict
                </button>
              </div>

              <p className="mt-4 text-xs leading-6 text-[#687367] dark:text-[#b0c0ae]">
                {selectedAssignment.submission?.summary ||
                  "IoT sensor integration telemetry and responsive web dashboard designed for dynamic electrical load distribution."}
              </p>

              {/* External Links / Submissions */}
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedAssignment.submission?.githubUrl && (
                  <a
                    href={selectedAssignment.submission.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#dfe4d8] bg-[#f8faf4] px-3 py-1.5 text-xs font-semibold text-[#324032] hover:bg-[#eef2e6] dark:border-[#334234] dark:bg-[#202c21] dark:text-[#d3dfd1]"
                  >
                    <ExternalLink size={12} /> View GitHub Repository
                  </a>
                )}
                {selectedAssignment.submission?.demoUrl && (
                  <a
                    href={selectedAssignment.submission.demoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#dfe4d8] bg-[#f8faf4] px-3 py-1.5 text-xs font-semibold text-[#324032] hover:bg-[#eef2e6] dark:border-[#334234] dark:bg-[#202c21] dark:text-[#d3dfd1]"
                  >
                    <ExternalLink size={12} /> Open Live Demo
                  </a>
                )}
              </div>
            </div>

            {/* Rubric Evaluation Form */}
            <div className="rounded-2xl border border-[#e2e6dc] bg-white p-6 shadow-sm dark:border-[#2b3a2d] dark:bg-[#1a251c]">
              <div className="flex items-center justify-between border-b border-[#e9ece3] pb-4 dark:border-[#283729]">
                <div>
                  <h3 className="font-display text-lg font-extrabold text-[#222c22] dark:text-[#eff7eb]">
                    Judging Criteria & Weights
                  </h3>
                  <p className="mt-0.5 text-xs text-[#8c9489] dark:text-[#9ea99b]">
                    Adjust score sliders for each dimension.
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#868e83]">
                    Weighted Total
                  </div>
                  <div className="font-display text-3xl font-extrabold text-[#719d2a]">
                    {Math.round(totalWeighted * 10) / 10} <span className="text-sm text-[#8c9489]">/ 100</span>
                  </div>
                </div>
              </div>

              {/* Criteria Sliders */}
              <div className="mt-6 space-y-6">
                {criteria.map((c) => (
                  <div key={c.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-[#2d382d] dark:text-[#e4efe2]">
                          {c.name}
                        </span>
                        <span className="ml-2 rounded-md bg-[#edf5ff] px-1.5 py-0.5 text-[10px] font-extrabold text-[#2a68a5] dark:bg-[#162738] dark:text-[#91c0ee]">
                          Weight: {c.weight}%
                        </span>
                      </div>
                      <span className="font-mono text-xs font-black text-[#719d2a]">
                        {scores[c.id] || 0} / {c.maxScore}
                      </span>
                    </div>

                    <p className="text-[11px] leading-4 text-[#8a9287] dark:text-[#9ea99b]">
                      {c.description}
                    </p>

                    <input
                      type="range"
                      min={0}
                      max={c.maxScore}
                      step={1}
                      value={scores[c.id] || 0}
                      onChange={(e) => handleScoreChange(c.id, Number(e.target.value))}
                      className="w-full accent-[#719d2a]"
                    />
                  </div>
                ))}
              </div>

              {/* Qualitative Comments */}
              <div className="mt-8 border-t border-[#e9ece3] pt-5 dark:border-[#283729]">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#556354] dark:text-[#b4c3b2]">
                    Qualitative Feedback & Remarks (Visible to participant in results round)
                  </span>
                  <textarea
                    rows={3}
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Provide constructive feedback on system trade-offs, architecture, or demo polish..."
                    className="w-full resize-none rounded-xl border border-[#dfe4d8] bg-white px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-[#b8f34a] dark:border-[#324233] dark:bg-[#18231a] dark:text-[#eff7ec]"
                  />
                </label>
              </div>

              {/* Actions */}
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#e9ece3] pt-5 dark:border-[#283729]">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSaveDraft}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#d8ded2] bg-[#fbfcf8] px-4 py-2.5 text-xs font-bold text-[#354335] shadow-sm hover:bg-[#eef2e6] dark:border-[#384839] dark:bg-[#202c21] dark:text-[#d3dfd1]"
                >
                  <Save size={13} /> Save Draft
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmitEvaluation}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#172017] px-6 py-2.5 text-xs font-bold text-white shadow-[0_4px_0_#0c110c] hover:-translate-y-0.5 active:translate-y-0 dark:bg-[#b8f34a] dark:text-[#172017] dark:shadow-[0_4px_0_#7eaa2a]"
                >
                  <Send size={13} /> Submit Evaluation
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid place-items-center rounded-2xl border border-dashed border-[#d8ded2] p-12 text-center text-xs text-[#8f968c]">
            Select a project from the left column to begin evaluation.
          </div>
        )}
      </div>
    </div>
  );
}
