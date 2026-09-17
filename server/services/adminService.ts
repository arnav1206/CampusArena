// =============================================================================
// Campus Arena — Platform Admin, Analytics, Disputes & Audit Service
// =============================================================================

import { db } from "../db/index.js";
import type {
  Dispute,
  AuditLog,
  User,
  Competition,
  PaymentTransaction,
} from "../../shared/types.js";

export class AdminService {
  /**
   * Platform Overview Analytics
   */
  static getPlatformMetrics() {
    const state = db.get();

    const totalStudents = state.users.filter((u) => u.role === "student").length;
    const totalCompetitions = state.competitions.length;
    const activeCompetitions = state.competitions.filter(
      (c) => c.status === "registration_open" || c.status === "ongoing"
    ).length;
    const totalTeams = state.teams.filter((t) => t.status !== "withdrawn").length;
    const totalRevenue = state.payments
      .filter((p) => p.status === "successful")
      .reduce((sum, p) => sum + p.amount, 0);
    const openDisputes = state.disputes.filter((d) => d.status === "open" || d.status === "under_review").length;
    const totalSubmissions = state.submissions.length;
    const totalCheckIns = state.attendanceRecords.length;

    return {
      totalStudents,
      totalCompetitions,
      activeCompetitions,
      totalTeams,
      totalRevenue,
      openDisputes,
      totalSubmissions,
      totalCheckIns,
    };
  }

  static getDisputes(competitionId?: string): Dispute[] {
    const disputes = db.get().disputes;
    if (competitionId) {
      return disputes.filter((d) => d.competitionId === competitionId);
    }
    return disputes;
  }

  static resolveDispute(params: {
    disputeId: string;
    resolvedByUserId: string;
    resolution: string;
    status: "resolved" | "dismissed";
  }): { success: boolean; dispute?: Dispute; error?: string } {
    const { disputeId, resolvedByUserId, resolution, status } = params;

    let updatedDispute: Dispute | undefined;
    let errorMsg: string | undefined;

    db.update((draft) => {
      const dispute = draft.disputes.find((d) => d.id === disputeId);
      if (!dispute) {
        errorMsg = "Dispute not found.";
        return;
      }

      const now = new Date().toISOString();
      dispute.status = status;
      dispute.resolution = resolution;
      dispute.resolvedByUserId = resolvedByUserId;
      dispute.resolvedAt = now;
      updatedDispute = dispute;

      // Notify user who raised dispute
      draft.notifications.unshift({
        id: `notif_${Date.now()}_${dispute.raisedByUserId}`,
        userId: dispute.raisedByUserId,
        competitionId: dispute.competitionId,
        category: "critical",
        title: `Dispute ${status.toUpperCase()}: ${dispute.type}`,
        message: `Admin resolution: ${resolution}`,
        isRead: false,
        createdAt: now,
      });

      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        competitionId: dispute.competitionId,
        actorUserId: resolvedByUserId,
        actorName: "Platform Admin",
        action: `DISPUTE_${status.toUpperCase()}`,
        entityType: "Dispute",
        entityId: dispute.id,
        details: `Dispute ${dispute.id} was ${status}. Resolution: ${resolution}`,
        timestamp: now,
      });
    });

    if (errorMsg) return { success: false, error: errorMsg };
    return { success: true, dispute: updatedDispute };
  }

  /**
   * Immutable Audit Log Queries
   */
  static getAuditLogs(params?: {
    competitionId?: string;
    actorUserId?: string;
    action?: string;
    limit?: number;
  }): AuditLog[] {
    let logs = [...db.get().auditLogs];

    if (params?.competitionId) {
      logs = logs.filter((l) => l.competitionId === params.competitionId);
    }
    if (params?.actorUserId) {
      logs = logs.filter((l) => l.actorUserId === params.actorUserId);
    }
    if (params?.action) {
      logs = logs.filter((l) => l.action.toLowerCase().includes(params.action!.toLowerCase()));
    }

    const limit = params?.limit || 100;
    return logs.slice(0, limit);
  }
}
