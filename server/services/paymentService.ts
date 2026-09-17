// =============================================================================
// Campus Arena — Payment Gateway Abstraction & Accounting Service
// =============================================================================

import { db } from "../db/index.js";
import type {
  PaymentTransaction,
  PaymentStatus,
  Coupon,
  FeeWaiver,
} from "../../shared/types.js";
import { calculateTeamFee } from "../../shared/business-rules.js";
import { computeTeamStatus } from "../../shared/state-machines.js";

export class PaymentService {
  static getPaymentsByCompetition(competitionId: string): PaymentTransaction[] {
    return db.get().payments.filter((p) => p.competitionId === competitionId);
  }

  static getPaymentByTeam(teamId: string): PaymentTransaction | undefined {
    return db.get().payments.find((p) => p.teamId === teamId);
  }

  static getCouponsByCompetition(competitionId: string): Coupon[] {
    return db.get().coupons.filter((c) => c.competitionId === competitionId);
  }

  static validateCoupon(competitionId: string, code: string): { valid: boolean; coupon?: Coupon; error?: string } {
    const cleanCode = code.trim().toUpperCase();
    const coupon = db.get().coupons.find(
      (c) => c.competitionId === competitionId && c.code.toUpperCase() === cleanCode
    );

    if (!coupon || !coupon.isActive) {
      return { valid: false, error: "Invalid coupon code." };
    }

    if (coupon.usedCount >= coupon.usageLimit) {
      return { valid: false, error: "Coupon usage limit has been reached." };
    }

    if (new Date(coupon.expiresAt).getTime() < Date.now()) {
      return { valid: false, error: "Coupon has expired." };
    }

    return { valid: true, coupon };
  }

  /**
   * Calculate summary for checkout
   */
  static calculateCheckout(params: {
    teamId: string;
    couponCode?: string;
  }) {
    const state = db.get();
    const team = state.teams.find((t) => t.id === params.teamId);
    if (!team) throw new Error("Team not found");

    const comp = state.competitions.find((c) => c.id === team.competitionId);
    if (!comp) throw new Error("Competition not found");

    const members = state.teamMembers.filter((m) => m.teamId === team.id);
    const waiver = state.waivers.find((w) => w.teamId === team.id);

    let coupon: Coupon | undefined;
    if (params.couponCode) {
      const val = this.validateCoupon(team.competitionId, params.couponCode);
      if (val.valid) coupon = val.coupon;
    }

    const fee = calculateTeamFee({
      pricing: comp.pricing,
      memberCount: members.length,
      coupon,
      waiver,
    });

    return {
      team,
      competition: comp,
      membersCount: members.length,
      coupon,
      waiver,
      ...fee,
    };
  }

  /**
   * Gateway Checkout Simulator
   * Executes server-side confirmation (Never trust client-side alone)
   */
  static processPayment(params: {
    teamId: string;
    payerUserId: string;
    couponCode?: string;
    gatewayProvider?: string;
  }): { success: boolean; transaction?: PaymentTransaction; error?: string } {
    const { teamId, payerUserId, couponCode, gatewayProvider = "CampusRazorpayUPI" } = params;

    let txn: PaymentTransaction | undefined;
    let errorMsg: string | undefined;

    db.update((draft) => {
      const team = draft.teams.find((t) => t.id === teamId);
      if (!team) {
        errorMsg = "Team not found.";
        return;
      }

      const comp = draft.competitions.find((c) => c.id === team.competitionId);
      if (!comp) {
        errorMsg = "Competition not found.";
        return;
      }

      const members = draft.teamMembers.filter((m) => m.teamId === teamId);
      const waiver = draft.waivers.find((w) => w.teamId === teamId);

      let coupon: Coupon | undefined;
      if (couponCode) {
        coupon = draft.coupons.find(
          (c) => c.competitionId === comp.id && c.code.toUpperCase() === couponCode.trim().toUpperCase()
        );
        if (coupon && coupon.isActive) {
          coupon.usedCount++;
        }
      }

      const calc = calculateTeamFee({
        pricing: comp.pricing,
        memberCount: members.length,
        coupon,
        waiver,
      });

      const now = new Date().toISOString();
      const invoiceNumber = `INV-${comp.slug.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;
      const transactionId = `TXN_${Date.now()}`;

      txn = {
        id: `pm_${Date.now()}`,
        teamId,
        competitionId: comp.id,
        payerUserId,
        amount: calc.netPayable,
        baseFee: calc.baseFee,
        additionalMembersFee: calc.additionalMembersFee,
        discountAmount: calc.discountAmount,
        couponCode: coupon?.code,
        waiverAmount: calc.waiverAmount,
        status: "successful",
        transactionId,
        gatewayProvider,
        gatewayResponse: {
          verifiedByServer: true,
          gatewayRef: `GW_${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
          paymentMode: "UPI_DIRECT",
          timestamp: now,
        },
        invoiceNumber,
        receiptUrl: `/api/payments/${transactionId}/receipt`,
        createdAt: now,
        paidAt: now,
      };

      draft.payments.push(txn);

      // Recompute team status to registered
      team.status = computeTeamStatus({
        memberCount: members.length,
        minSize: team.minSize,
        allMembersVerified: members.every((m) => m.isVerified),
        declarationsAccepted: team.declarationsAccepted,
        trackSelected: Boolean(team.trackId),
        isPaidOrFree: true,
        isPaymentOverdue: false,
      });

      // Notify all team members
      for (const m of members) {
        draft.notifications.unshift({
          id: `notif_${Date.now()}_${m.userId}`,
          userId: m.userId,
          competitionId: comp.id,
          category: "payment_updates",
          title: `Payment Successful: ${comp.title}`,
          message: `Team fee of ₹${calc.netPayable} for "${team.name}" has been confirmed. Official receipt is available.`,
          isRead: false,
          createdAt: now,
        });
      }

      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        competitionId: comp.id,
        actorUserId: payerUserId,
        actorName: "Payer",
        action: "PAYMENT_SUCCESSFUL",
        entityType: "PaymentTransaction",
        entityId: txn.id,
        details: `Successfully paid ₹${calc.netPayable} for team "${team.name}" via ${gatewayProvider}. Invoice: ${invoiceNumber}`,
        timestamp: now,
      });
    });

    if (errorMsg) return { success: false, error: errorMsg };
    return { success: true, transaction: txn };
  }

  /**
   * Issue Fee Waiver (Organizer action)
   */
  static issueWaiver(params: {
    teamId: string;
    competitionId: string;
    issuedByUserId: string;
    type: "full" | "partial" | "custom";
    waiverAmount: number;
    reason: string;
  }): { success: boolean; waiver?: FeeWaiver } {
    let waiver: FeeWaiver | undefined;
    db.update((draft) => {
      const now = new Date().toISOString();
      waiver = {
        id: `wv_${Date.now()}`,
        teamId: params.teamId,
        competitionId: params.competitionId,
        issuedByUserId: params.issuedByUserId,
        type: params.type,
        waiverAmount: params.waiverAmount,
        reason: params.reason,
        createdAt: now,
      };
      draft.waivers.push(waiver);

      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        competitionId: params.competitionId,
        actorUserId: params.issuedByUserId,
        actorName: "Organizer",
        action: "FEE_WAIVER_ISSUED",
        entityType: "FeeWaiver",
        entityId: waiver.id,
        details: `Issued ${params.type} waiver of ₹${params.waiverAmount} to team ${params.teamId}. Reason: ${params.reason}`,
        timestamp: now,
      });
    });

    return { success: true, waiver };
  }

  /**
   * Create Coupon Code
   */
  static createCoupon(coupon: Omit<Coupon, "id" | "usedCount">): Coupon {
    let created: Coupon | undefined;
    db.update((draft) => {
      created = {
        ...coupon,
        id: `cp_${Date.now()}`,
        usedCount: 0,
      };
      draft.coupons.push(created);

      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        competitionId: coupon.competitionId,
        actorUserId: "organizer",
        actorName: "Organizer",
        action: "COUPON_CREATED",
        entityType: "Coupon",
        entityId: created.id,
        details: `Created coupon ${created.code} (${created.discountType}: ${created.discountValue})`,
        timestamp: new Date().toISOString(),
      });
    });
    return created!;
  }
}
