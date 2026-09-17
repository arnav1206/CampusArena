// =============================================================================
// Campus Arena — Competition Management Service
// =============================================================================

import { db } from "../db/index.js";
import type {
  Competition,
  CompetitionStatus,
  Track,
  RegistrationField,
  WaitlistEntry,
} from "../../shared/types.js";
import {
  evaluateCompetitionReadiness,
  checkCapacity,
  type ReadinessReport,
} from "../../shared/business-rules.js";
import { canTransitionCompetition } from "../../shared/state-machines.js";

export class CompetitionService {
  static getAllCompetitions(activeOnly = false): Competition[] {
    const comps = db.get().competitions;
    if (activeOnly) {
      return comps.filter((c) => c.status !== "cancelled" && c.status !== "draft");
    }
    return comps;
  }

  static getCompetitionById(id: string): Competition | undefined {
    return db.get().competitions.find((c) => c.id === id || c.slug === id);
  }

  static getTracks(competitionId: string): Track[] {
    return db.get().tracks.filter((t) => t.competitionId === competitionId);
  }

  static getRegistrationFields(competitionId: string): RegistrationField[] {
    return db.get().registrationFields.filter((f) => f.competitionId === competitionId);
  }

  static replaceRegistrationFields(params: {
    competitionId: string;
    actorUserId: string;
    fields: Array<Partial<RegistrationField>>;
  }): { success: boolean; fields?: RegistrationField[]; error?: string } {
    const { competitionId, actorUserId, fields } = params;
    const allowedTypes: RegistrationField["type"][] = ["short_text", "long_text", "rich_text", "dropdown", "checkbox", "file_upload"];
    const comp = this.getCompetitionById(competitionId);
    if (!comp) return { success: false, error: "Competition not found." };
    if (!Array.isArray(fields) || fields.length > 30) return { success: false, error: "A registration form can contain between 0 and 30 fields." };

    const normalized: RegistrationField[] = [];
    for (let index = 0; index < fields.length; index += 1) {
      const field = fields[index];
      const label = field.label?.trim();
      const type = field.type;
      if (!label || label.length > 120 || !type || !allowedTypes.includes(type)) {
        return { success: false, error: `Field ${index + 1} needs a valid label and type.` };
      }
      const options = (field.options || []).map((option) => option.trim()).filter(Boolean).slice(0, 20);
      if ((type === "dropdown" || type === "checkbox") && options.length === 0) {
        return { success: false, error: `Field ${index + 1} needs at least one option.` };
      }
      normalized.push({
        id: field.id || `field_${Date.now()}_${index}`,
        competitionId,
        label,
        type,
        options: options.length ? options : undefined,
        required: Boolean(field.required),
        placeholder: field.placeholder?.trim().slice(0, 160) || undefined,
      });
    }

    db.update((draft) => {
      draft.registrationFields = draft.registrationFields.filter((field) => field.competitionId !== competitionId);
      draft.registrationFields.push(...normalized);
      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        competitionId,
        actorUserId,
        actorName: "Platform Admin",
        action: "REGISTRATION_FORM_UPDATED",
        entityType: "RegistrationForm",
        entityId: competitionId,
        details: `Saved ${normalized.length} registration form fields for ${comp.title}.`,
        timestamp: new Date().toISOString(),
      });
    });
    return { success: true, fields: normalized };
  }

  static getReadiness(competitionId: string): ReadinessReport | null {
    const comp = this.getCompetitionById(competitionId);
    if (!comp) return null;
    const tracks = this.getTracks(competitionId);
    const rounds = db.get().rounds.filter((r) => r.competitionId === competitionId);
    return evaluateCompetitionReadiness(comp, tracks.length, rounds.length);
  }

  static createOrUpdateDraft(
    publisherId: string,
    data: Partial<Competition>
  ): Competition {
    let competition: Competition;
    const isNew = !data.id || !this.getCompetitionById(data.id);

    db.update((draft) => {
      const now = new Date().toISOString();
      if (isNew) {
        competition = {
          id: data.id || `comp_${Date.now()}`,
          collegeId: "CAMPUS_MAIN",
          slug: data.slug || `competition-${Date.now()}`,
          title: data.title || "Untitled Competition Draft",
          type: data.type || "hackathon",
          overview: data.overview || "",
          description: data.description || "",
          branding: data.branding || {
            primaryColor: "#172017",
            accentColor: "#b8f34a",
            textColor: "#ffffff",
            logoText: "CA",
            gradient: "from-[#14213d] via-[#173c67] to-[#0e7490]",
          },
          dates: data.dates || {
            registrationReadyDate: now,
            competitionReadyDate: now,
            registrationDeadline: "",
            teamChangeDeadline: "",
            withdrawalDeadline: "",
            paymentDeadline: "",
            startDate: "",
            endDate: "",
          },
          capacity: data.capacity || {
            waitlistAcceptanceWindowHours: 24,
          },
          eligibility: data.eligibility || {
            verifiedCollegeStudentsOnly: true,
          },
          participationMode: data.participationMode || "both",
          teamRules: data.teamRules || {
            minTeamSize: 2,
            maxTeamSize: 5,
          },
          pricing: data.pricing || {
            isFree: true,
            baseTeamFee: 0,
            baseTeamMemberCount: 2,
            additionalMemberFee: 0,
            currency: "INR",
          },
          status: "draft",
          primaryPublisherId: publisherId,
          createdAt: now,
          updatedAt: now,
        };
        draft.competitions.push(competition);

        // Add primary publisher membership
        draft.organizerMemberships.push({
          id: `org_m_${Date.now()}`,
          competitionId: competition.id,
          userId: publisherId,
          role: "primary_publisher",
          permissions: [
            "manage_registration",
            "manage_participants",
            "manage_teams",
            "manage_payments",
            "manage_coupons",
            "manage_rounds",
            "manage_submissions",
            "manage_judging",
            "manage_attendance",
            "manage_certificates",
            "manage_announcements",
            "manage_reports",
            "manage_branding",
            "manage_organizing_team",
            "change_competition_settings",
            "cancel_competition",
            "view_audit_logs",
          ],
          addedAt: now,
        });

        draft.auditLogs.unshift({
          id: `aud_${Date.now()}`,
          competitionId: competition.id,
          actorUserId: publisherId,
          actorName: "Organizer",
          action: "COMPETITION_DRAFT_CREATED",
          entityType: "Competition",
          entityId: competition.id,
          details: `Created draft for competition: ${competition.title}`,
          timestamp: now,
        });
      } else {
        const existing = draft.competitions.find((c) => c.id === data.id);
        if (existing) {
          // Rule: team maximum size can only be increased after publishing, never decreased
          if (
            existing.status !== "draft" &&
            data.teamRules &&
            data.teamRules.maxTeamSize < existing.teamRules.maxTeamSize
          ) {
            throw new Error(
              `Maximum team size cannot be decreased after publishing (current: ${existing.teamRules.maxTeamSize})`
            );
          }

          Object.assign(existing, data, { updatedAt: now });
          competition = existing;

          draft.auditLogs.unshift({
            id: `aud_${Date.now()}`,
            competitionId: competition.id,
            actorUserId: publisherId,
            actorName: "Organizer",
            action: "COMPETITION_UPDATED",
            entityType: "Competition",
            entityId: competition.id,
            details: `Updated competition draft details: ${competition.title}`,
            timestamp: now,
          });
        }
      }
    });

    return competition!;
  }

  static setStatus(
    competitionId: string,
    nextStatus: CompetitionStatus,
    userId: string
  ): { success: boolean; competition?: Competition; error?: string } {
    let resultComp: Competition | undefined;
    let errMessage: string | undefined;

    db.update((draft) => {
      const comp = draft.competitions.find((c) => c.id === competitionId);
      if (!comp) {
        errMessage = "Competition not found.";
        return;
      }

      if (!canTransitionCompetition(comp.status, nextStatus)) {
        errMessage = `Invalid status transition from ${comp.status} to ${nextStatus}`;
        return;
      }

      const prev = comp.status;
      comp.status = nextStatus;
      comp.updatedAt = new Date().toISOString();
      resultComp = comp;

      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        competitionId,
        actorUserId: userId,
        actorName: "Organizer",
        action: "COMPETITION_STATUS_CHANGED",
        entityType: "Competition",
        entityId: competitionId,
        details: `Status transitioned from ${prev} to ${nextStatus}`,
        previousValue: prev,
        newValue: nextStatus,
        timestamp: new Date().toISOString(),
      });
    });

    if (errMessage) return { success: false, error: errMessage };
    return { success: true, competition: resultComp };
  }

  /**
   * Cancel competition:
   * Only Primary Publisher or explicit Cancel Competition permission
   * Automatically initiates full refunds to original sources
   */
  static cancelCompetition(
    competitionId: string,
    userId: string,
    reason: string
  ): { success: boolean; error?: string } {
    let errorMsg: string | undefined;

    db.update((draft) => {
      const comp = draft.competitions.find((c) => c.id === competitionId);
      if (!comp) {
        errorMsg = "Competition not found.";
        return;
      }

      // Check permission
      const membership = draft.organizerMemberships.find(
        (m) => m.competitionId === competitionId && m.userId === userId
      );
      const isPublisher = comp.primaryPublisherId === userId;
      const canCancel =
        isPublisher || membership?.permissions.includes("cancel_competition");

      if (!canCancel) {
        errorMsg = "Unauthorized: Only Primary Publisher or authorized organizer can cancel.";
        return;
      }

      const now = new Date().toISOString();
      comp.status = "cancelled";
      comp.cancellationReason = reason;
      comp.cancelledAt = now;
      comp.cancelledByUserId = userId;
      comp.updatedAt = now;

      // Auto refund all successful payments for this competition
      const paidTxns = draft.payments.filter(
        (p) => p.competitionId === competitionId && p.status === "successful"
      );

      for (const txn of paidTxns) {
        txn.status = "refunded";
        txn.refundedAt = now;
        txn.refundReason = `Competition cancelled: ${reason}`;

        // Notify payer
        draft.notifications.unshift({
          id: `notif_${Date.now()}_${txn.id}`,
          userId: txn.payerUserId,
          competitionId,
          category: "critical",
          title: `Refund Processed for ${comp.title}`,
          message: `Due to event cancellation, your registration payment of ₹${txn.amount} has been refunded to your original payment method.`,
          isRead: false,
          createdAt: now,
        });
      }

      // Notify all registered participants
      const compTeams = draft.teams.filter((t) => t.competitionId === competitionId);
      for (const t of compTeams) {
        const members = draft.teamMembers.filter((m) => m.teamId === t.id);
        for (const m of members) {
          draft.notifications.unshift({
            id: `notif_${Date.now()}_${m.userId}`,
            userId: m.userId,
            competitionId,
            category: "critical",
            title: `Competition Cancelled: ${comp.title}`,
            message: `Notice: ${comp.title} has been cancelled by organizers. Reason: ${reason}`,
            isRead: false,
            createdAt: now,
          });
        }
      }

      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        competitionId,
        actorUserId: userId,
        actorName: "Publisher",
        action: "COMPETITION_CANCELLED",
        entityType: "Competition",
        entityId: competitionId,
        details: `Competition cancelled. Reason: ${reason}. Automated refunds triggered for ${paidTxns.length} transactions.`,
        timestamp: now,
      });
    });

    if (errorMsg) return { success: false, error: errorMsg };
    return { success: true };
  }

  static getCapacityMetrics(competitionId: string) {
    const comp = this.getCompetitionById(competitionId);
    if (!comp) return null;

    const teams = db.get().teams.filter((t) => t.competitionId === competitionId && t.status !== "withdrawn");
    const members = db.get().teamMembers.filter((m) => {
      const team = teams.find((t) => t.id === m.teamId);
      return Boolean(team);
    });

    const currentTeamsCount = teams.length;
    const currentParticipantsCount = members.length;

    const capacityCheck = checkCapacity({
      maxParticipants: comp.capacity.maxParticipants,
      maxTeams: comp.capacity.maxTeams,
      currentParticipantsCount,
      currentTeamsCount,
    });

    return {
      ...capacityCheck,
      currentTeamsCount,
      currentParticipantsCount,
      maxTeams: comp.capacity.maxTeams,
      maxParticipants: comp.capacity.maxParticipants,
    };
  }
}
