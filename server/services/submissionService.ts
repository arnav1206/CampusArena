// =============================================================================
// Campus Arena — Submissions & File Security Validation Service
// =============================================================================

import { db } from "../db/index.js";
import type {
  Submission,
  SubmissionFile,
  Round,
} from "../../shared/types.js";

export class SubmissionService {
  static getSubmissionsByRound(roundId: string): Submission[] {
    return db.get().submissions.filter((s) => s.roundId === roundId);
  }

  static getSubmissionsByTeam(teamId: string): Submission[] {
    return db.get().submissions.filter((s) => s.teamId === teamId);
  }

  static getRoundsByCompetition(competitionId: string): Round[] {
    return db.get().rounds.filter((r) => r.competitionId === competitionId);
  }

  /**
   * Submit Project Work with File Security Validation Simulation
   */
  static submitWork(params: {
    roundId: string;
    teamId: string;
    submittedByUserId: string;
    title: string;
    summary: string;
    data: Record<string, any>;
    files: Array<{ name: string; sizeBytes: number; mimeType: string }>;
    githubUrl?: string;
    demoUrl?: string;
    videoUrl?: string;
  }): { success: boolean; submission?: Submission; error?: string } {
    const { roundId, teamId, submittedByUserId, title, summary, data, files, githubUrl, demoUrl, videoUrl } = params;

    const state = db.get();
    const round = state.rounds.find((r) => r.id === roundId);
    if (!round) return { success: false, error: "Round not found." };

    const team = state.teams.find((t) => t.id === teamId);
    if (!team) return { success: false, error: "Team not found." };

    // Validate deadlines (allow submission if active)
    const now = new Date().toISOString();
    const deadlineMs = new Date(round.submissionDeadline).getTime();
    if (Date.now() > deadlineMs && round.status === "completed") {
      return { success: false, error: "The deadline for this round has passed." };
    }

    // Validate and simulate malware & corruption scanning on files
    const validatedFiles: SubmissionFile[] = files.map((f, idx) => {
      // PPT/PDF limit: 20MB (20 * 1024 * 1024)
      // Images limit: 5MB (5 * 1024 * 1024)
      const isPdfOrPpt = f.mimeType.includes("pdf") || f.mimeType.includes("presentation") || f.name.endsWith(".ppt") || f.name.endsWith(".pptx") || f.name.endsWith(".pdf");
      const isImage = f.mimeType.includes("image") || f.name.endsWith(".png") || f.name.endsWith(".jpg") || f.name.endsWith(".jpeg");

      let status: SubmissionFile["status"] = "preview_available";
      if (isPdfOrPpt && f.sizeBytes > 20 * 1024 * 1024) {
        status = "invalid";
      } else if (isImage && f.sizeBytes > 5 * 1024 * 1024) {
        status = "invalid";
      }

      return {
        id: `file_${Date.now()}_${idx}`,
        name: f.name,
        url: `/storage/submissions/${teamId}/${f.name}`,
        sizeBytes: f.sizeBytes,
        mimeType: f.mimeType,
        status,
      };
    });

    let submission: Submission | undefined;
    db.update((draft) => {
      const existing = draft.submissions.find(
        (s) => s.roundId === roundId && s.teamId === teamId
      );

      if (existing) {
        existing.version++;
        existing.title = title;
        existing.summary = summary;
        existing.data = data;
        existing.files = validatedFiles;
        existing.githubUrl = githubUrl;
        existing.demoUrl = demoUrl;
        existing.videoUrl = videoUrl;
        existing.status = "submitted";
        existing.updatedAt = now;
        submission = existing;
      } else {
        submission = {
          id: `sub_${Date.now()}`,
          roundId,
          teamId,
          competitionId: round.competitionId,
          trackId: team.trackId,
          version: 1,
          status: "submitted",
          title,
          summary,
          data,
          files: validatedFiles,
          githubUrl,
          demoUrl,
          videoUrl,
          submittedByUserId,
          submittedAt: now,
          updatedAt: now,
        };
        draft.submissions.push(submission);
      }

      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        competitionId: round.competitionId,
        actorUserId: submittedByUserId,
        actorName: "Participant",
        action: "WORK_SUBMITTED",
        entityType: "Submission",
        entityId: submission!.id,
        details: `Submitted work for ${round.name} (Version ${submission!.version})`,
        timestamp: now,
      });
    });

    return { success: true, submission };
  }

  /**
   * Organizer extends submission deadline
   * Notifies affected Team Leaders ONLY
   */
  static extendRoundDeadline(params: {
    roundId: string;
    organizerUserId: string;
    newDeadline: string;
  }): { success: boolean; error?: string } {
    const { roundId, organizerUserId, newDeadline } = params;

    let errorMsg: string | undefined;
    db.update((draft) => {
      const round = draft.rounds.find((r) => r.id === roundId);
      if (!round) {
        errorMsg = "Round not found.";
        return;
      }

      const prev = round.submissionDeadline;
      round.submissionDeadline = newDeadline;

      // Find affected registered team leaders
      const teams = draft.teams.filter((t) => t.competitionId === round.competitionId);
      for (const t of teams) {
        draft.notifications.unshift({
          id: `notif_${Date.now()}_${t.leaderId}`,
          userId: t.leaderId,
          competitionId: round.competitionId,
          category: "deadline_changes",
          title: `Submission Deadline Extended: ${round.name}`,
          message: `The submission deadline for "${round.name}" has been extended to ${new Date(newDeadline).toLocaleString()}.`,
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      }

      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        competitionId: round.competitionId,
        actorUserId: organizerUserId,
        actorName: "Organizer",
        action: "DEADLINE_EXTENDED",
        entityType: "Round",
        entityId: roundId,
        details: `Submission deadline extended from ${prev} to ${newDeadline}. Affected team leaders notified.`,
        previousValue: prev,
        newValue: newDeadline,
        timestamp: new Date().toISOString(),
      });
    });

    if (errorMsg) return { success: false, error: errorMsg };
    return { success: true };
  }
}
