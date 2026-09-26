// =============================================================================
// Campus Arena — Judging, Scoring & Evaluation Service
// =============================================================================

import { db } from "../db/index.js";
import type {
  JudgingCriteria,
  JudgeAssignment,
  JudgingScore,
  Submission,
} from "../../shared/types.js";

export class JudgingService {
  static getCriteriaByRound(roundId: string): JudgingCriteria[] {
    return db.get().criteria.filter((c) => c.roundId === roundId);
  }

  static getAssignmentsForJudge(judgeUserId: string): Array<{
    assignment: JudgeAssignment;
    submission?: Submission;
    teamName: string;
    roundName: string;
    isBlind: boolean;
  }> {
    const state = db.get();
    const assignments = state.judgeAssignments.filter((a) => a.judgeUserId === judgeUserId);

    return assignments.map((assignment) => {
      const team = state.teams.find((t) => t.id === assignment.teamId);
      const round = state.rounds.find((r) => r.id === assignment.roundId);
      const submission = state.submissions.find(
        (s) => s.roundId === assignment.roundId && s.teamId === assignment.teamId
      );

      return {
        assignment,
        submission,
        teamName: round?.isBlindJudging ? `Team Code ${team?.code}` : team?.name || "Team",
        roundName: round?.name || "Round",
        isBlind: Boolean(round?.isBlindJudging),
      };
    });
  }

  static submitEvaluation(params: {
    assignmentId: string;
    judgeUserId: string;
    scores: Record<string, number>;
    comments: string;
    isDraft?: boolean;
  }): { success: boolean; score?: JudgingScore; error?: string } {
    const { assignmentId, judgeUserId, scores, comments, isDraft = false } = params;

    const state = db.get();
    const assignment = state.judgeAssignments.find((a) => a.id === assignmentId);
    if (!assignment) return { success: false, error: "Assignment not found." };
    if (assignment.judgeUserId !== judgeUserId) return { success: false, error: "Unauthorized judge." };

    const criteriaList = state.criteria.filter((c) => c.roundId === assignment.roundId);

    // Calculate weighted total score out of 100
    let totalWeightedScore = 0;
    for (const c of criteriaList) {
      const rawScore = scores[c.id] || 0;
      const normalizedScore = (rawScore / c.maxScore) * (c.weight);
      totalWeightedScore += normalizedScore;
    }
    totalWeightedScore = Math.round(totalWeightedScore * 10) / 10;

    let judgingScore: JudgingScore | undefined;
    db.update((draft) => {
      const now = new Date().toISOString();
      const existing = draft.scores.find((s) => s.assignmentId === assignmentId);

      if (existing) {
        existing.scores = scores;
        existing.totalWeightedScore = totalWeightedScore;
        existing.comments = comments;
        existing.isDraft = isDraft;
        if (!isDraft) existing.submittedAt = now;
        judgingScore = existing;
      } else {
        judgingScore = {
          id: `score_${Date.now()}`,
          assignmentId,
          judgeUserId,
          teamId: assignment.teamId,
          roundId: assignment.roundId,
          scores,
          totalWeightedScore,
          comments,
          isDraft,
          submittedAt: isDraft ? undefined : now,
        };
        draft.scores.push(judgingScore);
      }

      // Update assignment status
      const assign = draft.judgeAssignments.find((a) => a.id === assignmentId);
      if (assign) {
        assign.status = isDraft ? "in_progress" : "submitted";
      }

      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        competitionId: assignment.competitionId,
        actorUserId: judgeUserId,
        actorName: "Judge",
        action: isDraft ? "EVALUATION_SAVED_DRAFT" : "EVALUATION_SUBMITTED",
        entityType: "JudgingScore",
        entityId: assignmentId,
        details: `Judge ${isDraft ? "saved draft" : "submitted final evaluation"} for team ${assignment.teamId} (Weighted Score: ${totalWeightedScore})`,
        timestamp: now,
      });
    });

    return { success: true, score: judgingScore };
  }

  static declareConflict(assignmentId: string, judgeUserId: string, reason: string): boolean {
    let success = false;
    db.update((draft) => {
      const assign = draft.judgeAssignments.find(
        (a) => a.id === assignmentId && a.judgeUserId === judgeUserId
      );
      if (assign) {
        assign.status = "conflict";
        assign.conflictDeclared = true;
        success = true;

        draft.auditLogs.unshift({
          id: `aud_${Date.now()}`,
          competitionId: assign.competitionId,
          actorUserId: judgeUserId,
          actorName: "Judge",
          action: "CONFLICT_DECLARED",
          entityType: "JudgeAssignment",
          entityId: assignmentId,
          details: `Judge declared conflict of interest. Reason: ${reason}`,
          timestamp: new Date().toISOString(),
        });
      }
    });
    return success;
  }

  static getAllSubmissions(competitionId?: string): Array<{
    submission: Submission;
    teamName: string;
    competitionTitle: string;
    roundName: string;
    submittedByName: string;
    evaluationsCount: number;
    averageWeightedScore: number | null;
  }> {
    const state = db.get();
    let subs = state.submissions;
    if (competitionId) {
      subs = subs.filter((s) => s.competitionId === competitionId);
    }

    return subs.map((sub) => {
      const team = state.teams.find((t) => t.id === sub.teamId);
      const comp = state.competitions.find((c) => c.id === sub.competitionId);
      const round = state.rounds.find((r) => r.id === sub.roundId);
      const submitter = state.users.find((u) => u.id === sub.submittedByUserId);
      const assignments = state.judgeAssignments.filter(
        (a) => a.roundId === sub.roundId && a.teamId === sub.teamId
      );
      const assignmentIds = new Set(assignments.map((a) => a.id));
      const scores = state.scores.filter((s) => assignmentIds.has(s.assignmentId) && !s.isDraft);

      const avgScore =
        scores.length > 0
          ? Math.round((scores.reduce((sum, s) => sum + s.totalWeightedScore, 0) / scores.length) * 10) / 10
          : null;

      return {
        submission: sub,
        teamName: team?.name || "Team",
        competitionTitle: comp?.title || "Competition",
        roundName: round?.name || "Round",
        submittedByName: submitter?.name || "Participant",
        evaluationsCount: scores.length,
        averageWeightedScore: avgScore,
      };
    });
  }

  static getSubmissionsWithReviews(competitionId: string) {
    const state = db.get();
    const subs = state.submissions.filter((s) => s.competitionId === competitionId);

    return subs.map((sub) => {
      const team = state.teams.find((t) => t.id === sub.teamId);
      const round = state.rounds.find((r) => r.id === sub.roundId);
      const track = state.tracks.find((t) => t.id === sub.trackId);
      const assignments = state.judgeAssignments.filter(
        (a) => a.roundId === sub.roundId && a.teamId === sub.teamId
      );

      const reviews = assignments.map((assign) => {
        const judgeUser = state.users.find((u) => u.id === assign.judgeUserId);
        const scoreObj = state.scores.find((s) => s.assignmentId === assign.id);
        const criteriaList = state.criteria.filter((c) => c.roundId === assign.roundId);

        return {
          assignment: assign,
          judgeName: judgeUser?.name || "Unknown Judge",
          judgeEmail: judgeUser?.email || "",
          score: scoreObj || null,
          criteria: criteriaList,
        };
      });

      return {
        submission: sub,
        teamName: team?.name || "Team",
        teamCode: team?.code || "N/A",
        roundName: round?.name || "Round",
        trackName: track?.name || "General",
        reviews,
      };
    });
  }

  static assignJudgeToTeam(params: {
    roundId: string;
    competitionId: string;
    judgeUserId: string;
    teamId: string;
  }) {
    const { roundId, competitionId, judgeUserId, teamId } = params;
    const state = db.get();
    const existing = state.judgeAssignments.find(
      (a) => a.roundId === roundId && a.teamId === teamId && a.judgeUserId === judgeUserId
    );
    if (existing) {
      return { success: true, assignment: existing, message: "Judge is already assigned." };
    }

    const id = `ja_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newAssignment: JudgeAssignment = {
      id,
      roundId,
      competitionId,
      judgeUserId,
      teamId,
      status: "assigned",
    };

    db.update((draft) => {
      draft.judgeAssignments.push(newAssignment);
      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        competitionId,
        actorUserId: "organizer",
        actorName: "Organizer",
        action: "JUDGE_ASSIGNED",
        entityType: "JudgeAssignment",
        entityId: id,
        details: `Assigned judge ${judgeUserId} to team ${teamId} for round ${roundId}`,
        timestamp: new Date().toISOString(),
      });
    });

    return { success: true, assignment: newAssignment };
  }

  static getAllReviewsForAdmin() {
    const state = db.get();
    return state.scores.map((score) => {
      const assignment = state.judgeAssignments.find((a) => a.id === score.assignmentId);
      const judgeUser = state.users.find((u) => u.id === score.judgeUserId);
      const team = state.teams.find((t) => t.id === score.teamId);
      const round = state.rounds.find((r) => r.id === score.roundId);
      const competition = state.competitions.find((c) => c.id === assignment?.competitionId || round?.competitionId);
      const submission = state.submissions.find(
        (s) => s.roundId === score.roundId && s.teamId === score.teamId
      );
      const criteriaList = state.criteria.filter((c) => c.roundId === score.roundId);

      return {
        score,
        assignment,
        judgeName: judgeUser?.name || "Judge",
        judgeEmail: judgeUser?.email || "",
        teamName: team?.name || "Team",
        roundName: round?.name || "Round",
        competitionTitle: competition?.title || "Competition",
        submissionTitle: submission?.title || "Project Submission",
        submissionUrl: submission?.demoUrl || submission?.githubUrl || "",
        criteria: criteriaList,
      };
    });
  }
}

