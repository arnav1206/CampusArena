// =============================================================================
// Campus Arena — Authoritative State Machines & Transition Guards
// =============================================================================

import type {
  CompetitionStatus,
  TeamStatus,
  PaymentStatus,
  SubmissionStatus,
  JudgingStatus,
  AttendanceStatus,
} from "./types";

/**
 * Competition Lifecycle State Machine
 * Note: Organizers manually control status. The system warns about date/status
 * inconsistencies, but NEVER automatically changes the organizer's selected status.
 */
export const VALID_COMPETITION_TRANSITIONS: Record<CompetitionStatus, CompetitionStatus[]> = {
  draft: ["published", "registration_open", "cancelled"],
  published: ["registration_open", "draft", "cancelled"],
  registration_open: ["registration_closed", "ongoing", "cancelled"],
  registration_closed: ["ongoing", "registration_open", "completed", "cancelled"],
  ongoing: ["completed", "cancelled"],
  completed: [], // Terminal normal state
  cancelled: [], // Terminal cancellation state
};

export function canTransitionCompetition(
  current: CompetitionStatus,
  next: CompetitionStatus
): boolean {
  if (current === next) return true;
  return VALID_COMPETITION_TRANSITIONS[current]?.includes(next) ?? false;
}

/**
 * System-generated Team Status State Machine
 * System-generated; organizer cannot arbitrarily overwrite system team status.
 */
export const VALID_TEAM_TRANSITIONS: Record<TeamStatus, TeamStatus[]> = {
  formation: ["awaiting_verification", "ready_to_complete", "incomplete", "withdrawn"],
  awaiting_verification: ["ready_to_complete", "formation", "incomplete", "withdrawn"],
  ready_to_complete: ["payment_pending", "registered", "incomplete", "withdrawn"],
  payment_pending: ["registered", "payment_overdue", "withdrawn"],
  registered: ["incomplete", "withdrawn"], // Changes post finalization require organizer approval
  payment_overdue: ["registered", "incomplete", "withdrawn"],
  incomplete: ["formation", "awaiting_verification", "ready_to_complete", "withdrawn"],
  withdrawn: [], // Terminal
};

export function computeTeamStatus(params: {
  memberCount: number;
  minSize: number;
  allMembersVerified: boolean;
  declarationsAccepted: boolean;
  trackSelected: boolean;
  isPaidOrFree: boolean;
  isPaymentOverdue: boolean;
  isWithdrawn?: boolean;
}): TeamStatus {
  if (params.isWithdrawn) return "withdrawn";

  if (params.memberCount < params.minSize) {
    return "incomplete";
  }

  if (!params.allMembersVerified) {
    return "awaiting_verification";
  }

  if (!params.trackSelected || !params.declarationsAccepted) {
    return "ready_to_complete";
  }

  if (!params.isPaidOrFree) {
    return params.isPaymentOverdue ? "payment_overdue" : "payment_pending";
  }

  return "registered";
}

/**
 * Payment State Machine
 */
export const VALID_PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ["processing", "successful", "failed", "overdue"],
  processing: ["successful", "failed"],
  successful: ["refund_pending", "refunded"],
  failed: ["pending", "processing"],
  overdue: ["processing", "successful"],
  refund_pending: ["refunded"],
  refunded: [],
};

/**
 * Submission State Machine
 */
export const VALID_SUBMISSION_TRANSITIONS: Record<SubmissionStatus, SubmissionStatus[]> = {
  not_started: ["draft", "submitted"],
  draft: ["submitted"],
  submitted: ["locked", "resubmission_available"],
  locked: ["resubmission_available"],
  resubmission_available: ["submitted"],
  deadline_passed: [],
};

/**
 * Judging Status State Machine
 */
export const VALID_JUDGING_TRANSITIONS: Record<JudgingStatus, JudgingStatus[]> = {
  not_assigned: ["assigned"],
  assigned: ["in_progress", "conflict"],
  in_progress: ["submitted", "conflict"],
  submitted: ["finalized"],
  conflict: ["not_assigned", "assigned"],
  finalized: [],
};
