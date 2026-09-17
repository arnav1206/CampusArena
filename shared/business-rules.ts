// =============================================================================
// Campus Arena — Business Rules & Calculation Engine
// =============================================================================

import type {
  PricingConfig,
  Coupon,
  FeeWaiver,
  Competition,
  Team,
  Submission,
} from "./types.js";

/**
 * Pricing Calculation:
 * Base team fee + optional additional member fee
 * Example: ₹500 for 2 members + ₹150 per additional member
 */
export function calculateTeamFee(params: {
  pricing: PricingConfig;
  memberCount: number;
  coupon?: Coupon;
  waiver?: FeeWaiver;
}): {
  baseFee: number;
  additionalMembersCount: number;
  additionalMembersFee: number;
  grossAmount: number;
  discountAmount: number;
  waiverAmount: number;
  netPayable: number;
} {
  const { pricing, memberCount, coupon, waiver } = params;

  if (pricing.isFree) {
    return {
      baseFee: 0,
      additionalMembersCount: 0,
      additionalMembersFee: 0,
      grossAmount: 0,
      discountAmount: 0,
      waiverAmount: 0,
      netPayable: 0,
    };
  }

  const baseFee = pricing.baseTeamFee;
  const additionalMembersCount = Math.max(0, memberCount - pricing.baseTeamMemberCount);
  const additionalMembersFee = additionalMembersCount * (pricing.additionalMemberFee || 0);
  const grossAmount = baseFee + additionalMembersFee;

  // Coupon discount calculation
  let discountAmount = 0;
  if (coupon && coupon.isActive) {
    if (coupon.discountType === "percentage") {
      discountAmount = Math.round((grossAmount * coupon.discountValue) / 100);
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    } else {
      discountAmount = Math.min(coupon.discountValue, grossAmount);
    }
  }

  // Waiver calculation
  let waiverAmount = 0;
  if (waiver) {
    if (waiver.type === "full") {
      waiverAmount = Math.max(0, grossAmount - discountAmount);
    } else {
      waiverAmount = Math.min(waiver.waiverAmount, Math.max(0, grossAmount - discountAmount));
    }
  }

  const netPayable = Math.max(0, grossAmount - discountAmount - waiverAmount);

  return {
    baseFee,
    additionalMembersCount,
    additionalMembersFee,
    grossAmount,
    discountAmount,
    waiverAmount,
    netPayable,
  };
}

/**
 * Capacity Calculation
 * Each team = 1 team unit
 * Each participant = 1 participant unit
 */
export function checkCapacity(params: {
  maxParticipants?: number;
  maxTeams?: number;
  currentParticipantsCount: number;
  currentTeamsCount: number;
  incomingTeamSize?: number;
}): {
  canRegisterTeam: boolean;
  canRegisterIndividual: boolean;
  isFull: boolean;
  participantSpotsLeft: number;
  teamSpotsLeft: number;
  warning?: string;
} {
  const {
    maxParticipants,
    maxTeams,
    currentParticipantsCount,
    currentTeamsCount,
    incomingTeamSize = 1,
  } = params;

  const teamCapacityUnlimited = maxTeams === undefined || maxTeams <= 0;
  const participantCapacityUnlimited = maxParticipants === undefined || maxParticipants <= 0;

  const teamSpotsLeft = teamCapacityUnlimited ? 999999 : Math.max(0, maxTeams - currentTeamsCount);
  const participantSpotsLeft = participantCapacityUnlimited
    ? 999999
    : Math.max(0, maxParticipants - currentParticipantsCount);

  const canRegisterTeam =
    (teamCapacityUnlimited || currentTeamsCount + 1 <= maxTeams) &&
    (participantCapacityUnlimited || currentParticipantsCount + incomingTeamSize <= maxParticipants);

  const canRegisterIndividual =
    participantCapacityUnlimited || currentParticipantsCount + 1 <= maxParticipants;

  let warning: string | undefined;
  if (teamCapacityUnlimited && participantCapacityUnlimited) {
    warning = "Both participant and team capacities are unlimited. We recommend setting capacity planning limits.";
  }

  return {
    canRegisterTeam,
    canRegisterIndividual,
    isFull: !canRegisterTeam && !canRegisterIndividual,
    participantSpotsLeft,
    teamSpotsLeft,
    warning,
  };
}

/**
 * Competition Readiness Calculation
 * Registration Ready Date: all discovery & registration info complete
 * Competition Ready Date: all non-judging competition setup complete, at least 1 week before
 */
export interface ReadinessReport {
  overallPercentage: number;
  isRegistrationReady: boolean;
  isCompetitionReady: boolean;
  missingItems: string[];
  warnings: string[];
}

export function evaluateCompetitionReadiness(competition: Competition, tracksCount: number, roundsCount: number): ReadinessReport {
  const missingItems: string[] = [];
  const warnings: string[] = [];

  // Discovery / Registration essentials
  if (!competition.title?.trim()) missingItems.push("Competition Title is missing");
  if (!competition.overview?.trim()) missingItems.push("Competition Overview is missing");
  if (!competition.description?.trim()) missingItems.push("Full Description is missing");
  if (!competition.dates.registrationDeadline) missingItems.push("Registration Deadline is not configured");
  if (tracksCount === 0) missingItems.push("At least one Track must be defined");
  if (competition.teamRules.minTeamSize <= 0) missingItems.push("Valid minimum team size is required");
  if (competition.teamRules.maxTeamSize < competition.teamRules.minTeamSize) {
    missingItems.push("Maximum team size must be >= minimum team size");
  }

  const isRegistrationReady = missingItems.length === 0;

  // Competition ready essentials (non-judging)
  const compMissing: string[] = [];
  if (roundsCount === 0) compMissing.push("At least one Round must be configured");
  if (!competition.dates.startDate) compMissing.push("Competition Start Date is missing");
  if (!competition.dates.endDate) compMissing.push("Competition End Date is missing");

  // Check 1 week rule: Competition Ready Date must be at least 1 week before start date
  if (competition.dates.competitionReadyDate && competition.dates.startDate) {
    const readyMs = new Date(competition.dates.competitionReadyDate).getTime();
    const startMs = new Date(competition.dates.startDate).getTime();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    if (startMs - readyMs < oneWeekMs) {
      warnings.push("Competition Ready Date should be configured at least one week prior to event start.");
    }
  }

  const allIssues = [...missingItems, ...compMissing];
  const isCompetitionReady = allIssues.length === 0;

  // Calculate percentage out of 10 key criteria
  const totalChecks = 10;
  const passedChecks = totalChecks - Math.min(totalChecks, allIssues.length);
  const overallPercentage = Math.round((passedChecks / totalChecks) * 100);

  return {
    overallPercentage,
    isRegistrationReady,
    isCompetitionReady,
    missingItems: allIssues,
    warnings,
  };
}

/**
 * Team Member Removal Eligibility
 * BEFORE both team finalization AND payment: Team voting
 * AFTER either team finalization OR payment: Organizer approval only
 */
export function getMemberRemovalMode(team: Team, isPaid: boolean): "voting" | "organizer_approval" {
  if (!team.finalizedAt && !isPaid) {
    return "voting";
  }
  return "organizer_approval";
}

/**
 * Track Change Eligibility
 * Max once per team, before first project submission, requires organizer approval.
 * Locked permanently after submission.
 */
export function canRequestTrackChange(team: Team, hasSubmitted: boolean): {
  allowed: boolean;
  reason?: string;
} {
  if (hasSubmitted) {
    return {
      allowed: false,
      reason: "Track change is permanently locked after project submission.",
    };
  }

  if (team.trackChangeUsed) {
    return {
      allowed: false,
      reason: "Track change can only be requested a maximum of once.",
    };
  }

  return { allowed: true };
}
