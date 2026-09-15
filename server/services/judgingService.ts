// =============================================================================
// Campus Arena — Judging, Scoring & Evaluation Service
// =============================================================================

import { db } from "../db";
import type {
  JudgingCriteria,
  JudgeAssignment,
  JudgingScore,
  Submission,
} from "../../shared/types";

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
}
