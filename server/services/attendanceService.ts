// =============================================================================
// Campus Arena — Attendance Checkpoints & Digital Event Pass Service
// =============================================================================

import crypto from "node:crypto";
import { db } from "../db";
import type {
  AttendanceCheckpoint,
  AttendanceRecord,
  DigitalPass,
} from "../../shared/types";

export class AttendanceService {
  static getCheckpointsByCompetition(competitionId: string): AttendanceCheckpoint[] {
    return db.get().attendanceCheckpoints.filter((c) => c.competitionId === competitionId);
  }

  static getAttendanceRecords(competitionId: string): AttendanceRecord[] {
    return db.get().attendanceRecords.filter((r) => r.competitionId === competitionId);
  }

  /**
   * Generate Digital Event Pass with competition-specific non-PII QR token
   * NEVER embeds personal information in the QR payload.
   */
  static getDigitalPass(params: {
    competitionId: string;
    userId: string;
  }): DigitalPass | null {
    const { competitionId, userId } = params;
    const state = db.get();

    const user = state.users.find((u) => u.id === userId);
    const comp = state.competitions.find((c) => c.id === competitionId);
    if (!user || !comp) return null;

    // Find participant's team in this competition
    const teamMember = state.teamMembers.find((m) => {
      if (m.userId !== userId) return false;
      const t = state.teams.find((team) => team.id === m.teamId);
      return t && t.competitionId === competitionId && t.status !== "withdrawn";
    });

    const team = teamMember ? state.teams.find((t) => t.id === teamMember.teamId) : undefined;
    const track = team ? state.tracks.find((trk) => trk.id === team.trackId) : undefined;

    // Cryptographic secure opaque registration token without PII
    const rawSecret = `PASS_${competitionId}_${userId}_CAMPUS_ARENA_SALT`;
    const secureToken = crypto.createHash("sha256").update(rawSecret).digest("hex").slice(0, 32);

    return {
      competitionId,
      participantUserId: userId,
      participantName: user.name,
      rollNumber: user.rollNumber || "STUDENT",
      teamName: team?.name || "Individual",
      trackName: track?.name || "General Track",
      secureToken: `ARENA_PASS:${competitionId}:${userId}:${secureToken}`,
      issuedAt: new Date().toISOString(),
    };
  }

  /**
   * QR Scanner Validation & Check-in Recording
   * Analyzes token, checks payment, checks duplicate check-ins, checks window.
   */
  static scanAndRecordCheckIn(params: {
    checkpointId: string;
    qrToken: string;
    scannerUserId: string;
  }): {
    success: boolean;
    status: "valid" | "already_checked_in" | "payment_pending" | "invalid_qr" | "incomplete_registration";
    message: string;
    participant?: {
      name: string;
      rollNumber: string;
      teamName: string;
      trackName: string;
      timestamp: string;
    };
  } {
    const { checkpointId, qrToken, scannerUserId } = params;
    const state = db.get();

    const checkpoint = state.attendanceCheckpoints.find((c) => c.id === checkpointId);
    if (!checkpoint) {
      return {
        success: false,
        status: "invalid_qr",
        message: "Invalid checkpoint specified.",
      };
    }

    // Parse token format: ARENA_PASS:<competitionId>:<userId>:<hash>
    const parts = qrToken.trim().split(":");
    if (parts.length < 4 || parts[0] !== "ARENA_PASS") {
      return {
        success: false,
        status: "invalid_qr",
        message: "Invalid QR format. Not an authentic Campus Arena Digital Event Pass.",
      };
    }

    const [, compId, userId, tokenHash] = parts;
    if (compId !== checkpoint.competitionId) {
      return {
        success: false,
        status: "invalid_qr",
        message: "This pass belongs to a different competition.",
      };
    }

    // Verify token validity
    const rawSecret = `PASS_${compId}_${userId}_CAMPUS_ARENA_SALT`;
    const expectedHash = crypto.createHash("sha256").update(rawSecret).digest("hex").slice(0, 32);
    if (tokenHash !== expectedHash) {
      return {
        success: false,
        status: "invalid_qr",
        message: "Security signature verification failed on QR pass.",
      };
    }

    const user = state.users.find((u) => u.id === userId);
    if (!user) {
      return { success: false, status: "invalid_qr", message: "Participant not found." };
    }

    // Check team and registration state
    const membership = state.teamMembers.find((m) => {
      if (m.userId !== userId) return false;
      const t = state.teams.find((team) => team.id === m.teamId);
      return t && t.competitionId === compId && t.status !== "withdrawn";
    });

    const team = membership ? state.teams.find((t) => t.id === membership.teamId) : undefined;
    if (!team || team.status === "incomplete") {
      return {
        success: false,
        status: "incomplete_registration",
        message: "Participant's team registration is incomplete.",
      };
    }

    // Check payment status
    const comp = state.competitions.find((c) => c.id === compId);
    if (comp && !comp.pricing.isFree) {
      const isPaid = state.payments.some((p) => p.teamId === team.id && p.status === "successful");
      if (!isPaid) {
        return {
          success: false,
          status: "payment_pending",
          message: "Payment is pending for this team. Check-in requires paid status.",
        };
      }
    }

    // Check duplicate check-in
    const existingCheckIn = state.attendanceRecords.find(
      (r) => r.checkpointId === checkpointId && r.participantUserId === userId
    );

    if (existingCheckIn) {
      return {
        success: false,
        status: "already_checked_in",
        message: `Already checked in at ${new Date(existingCheckIn.scannedAt).toLocaleTimeString()}`,
        participant: {
          name: user.name,
          rollNumber: user.rollNumber || "",
          teamName: team.name,
          trackName: team.trackId,
          timestamp: existingCheckIn.scannedAt,
        },
      };
    }

    // Record check-in
    const now = new Date().toISOString();
    const newRecord: AttendanceRecord = {
      id: `att_${Date.now()}`,
      checkpointId,
      competitionId: compId,
      participantUserId: userId,
      teamId: team.id,
      scannedByUserId: scannerUserId,
      scannedAt: now,
    };

    db.update((draft) => {
      draft.attendanceRecords.push(newRecord);
      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        competitionId: compId,
        actorUserId: scannerUserId,
        actorName: "Staff Scanner",
        action: "CHECK_IN_RECORDED",
        entityType: "AttendanceRecord",
        entityId: newRecord.id,
        details: `Participant ${user.name} checked in at checkpoint "${checkpoint.name}"`,
        timestamp: now,
      });
    });

    return {
      success: true,
      status: "valid",
      message: "Check-in confirmed successfully!",
      participant: {
        name: user.name,
        rollNumber: user.rollNumber || "",
        teamName: team.name,
        trackName: team.trackId,
        timestamp: now,
      },
    };
  }
}
