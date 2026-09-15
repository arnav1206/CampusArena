// =============================================================================
// Campus Arena — Certificates & Showcase Service
// =============================================================================

import { db } from "../db";
import type { Certificate, CompetitionReview } from "../../shared/types";

export class CertificateService {
  static getCertificatesForUser(userId: string): Certificate[] {
    return db.get().certificates.filter((c) => c.userId === userId);
  }

  static getCertificatesByCompetition(competitionId: string): Certificate[] {
    return db.get().certificates.filter((c) => c.competitionId === competitionId);
  }

  /**
   * Evaluate eligibility for a participant
   */
  static checkEligibility(competitionId: string, userId: string): {
    eligible: boolean;
    reasons: string[];
  } {
    const state = db.get();
    const reasons: string[] = [];

    // Check attendance checkpoint criteria
    const mandatoryCheckpoints = state.attendanceCheckpoints.filter(
      (c) => c.competitionId === competitionId && c.requiredForCertificate
    );

    const userAttendance = state.attendanceRecords.filter(
      (r) => r.competitionId === competitionId && r.participantUserId === userId
    );

    for (const chk of mandatoryCheckpoints) {
      const attended = userAttendance.some((r) => r.checkpointId === chk.id);
      if (!attended) {
        reasons.push(`Missing mandatory attendance checkpoint: ${chk.name}`);
      }
    }

    return {
      eligible: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Issue Certificate (Organizer action)
   */
  static issueCertificate(params: {
    competitionId: string;
    userId: string;
    type: Certificate["type"];
    title: string;
    subtitle: string;
    teamName: string;
  }): Certificate {
    const state = db.get();
    const user = state.users.find((u) => u.id === params.userId);

    const code = `CERT-${params.competitionId.substring(5, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();

    const cert: Certificate = {
      id: `cert_${Date.now()}`,
      competitionId: params.competitionId,
      userId: params.userId,
      userName: user?.name || "Participant",
      teamName: params.teamName,
      type: params.type,
      title: params.title,
      subtitle: params.subtitle,
      issuedDate: now.slice(0, 10),
      verificationCode: code,
      eligible: true,
    };

    db.update((draft) => {
      draft.certificates.push(cert);
      draft.notifications.unshift({
        id: `notif_${Date.now()}_${params.userId}`,
        userId: params.userId,
        competitionId: params.competitionId,
        category: "announcements",
        title: "Official Certificate Available!",
        message: `Your ${params.type} certificate for "${params.title}" has been issued. You can preview and download it now.`,
        isRead: false,
        createdAt: now,
      });

      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        competitionId: params.competitionId,
        actorUserId: "organizer",
        actorName: "Organizer",
        action: "CERTIFICATE_ISSUED",
        entityType: "Certificate",
        entityId: cert.id,
        details: `Issued ${params.type} certificate to ${user?.name} (${code})`,
        timestamp: now,
      });
    });

    return cert;
  }

  /**
   * Submit anonymous review for completed showcase
   * (Optional, NEVER blocks certificate download)
   */
  static submitReview(params: {
    competitionId: string;
    rating: number;
    positives: string;
    improvements: string;
  }): CompetitionReview {
    const review: CompetitionReview = {
      id: `rev_${Date.now()}`,
      competitionId: params.competitionId,
      rating: params.rating,
      positives: params.positives,
      improvements: params.improvements,
      isAnonymous: true,
      createdAt: new Date().toISOString(),
    };

    db.update((draft) => {
      draft.reviews.push(review);
    });

    return review;
  }

  static getShowcaseReviews(competitionId: string): CompetitionReview[] {
    return db.get().reviews.filter((r) => r.competitionId === competitionId);
  }
}
