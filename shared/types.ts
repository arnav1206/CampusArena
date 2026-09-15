// =============================================================================
// Campus Arena — Comprehensive Domain Model & Type System
// =============================================================================

export type PlatformRole =
  | "student"
  | "organizer"
  | "faculty"
  | "judge"
  | "admin";

export type CompetitionRole =
  | "primary_publisher"
  | "co_publisher"
  | "organizing_faculty"
  | "organizer"
  | "judge"
  | "team_leader"
  | "participant";

export type CompetitionPermission =
  | "manage_registration"
  | "manage_participants"
  | "manage_teams"
  | "manage_payments"
  | "manage_coupons"
  | "manage_rounds"
  | "manage_submissions"
  | "manage_judging"
  | "manage_attendance"
  | "manage_certificates"
  | "manage_announcements"
  | "manage_reports"
  | "manage_branding"
  | "manage_organizing_team"
  | "change_competition_settings"
  | "cancel_competition"
  | "view_audit_logs";

export type CompetitionStatus =
  | "draft"
  | "published"
  | "registration_open"
  | "registration_closed"
  | "ongoing"
  | "completed"
  | "cancelled";

export type CompetitionType =
  | "hackathon"
  | "ideathon"
  | "startup_summit"
  | "case_competition"
  | "quiz"
  | "design_competition"
  | "pitch_competition"
  | "other";

export type ParticipationMode =
  | "team_required"
  | "individual_allowed"
  | "both";

export type TeamStatus =
  | "formation"
  | "awaiting_verification"
  | "ready_to_complete"
  | "payment_pending"
  | "registered"
  | "payment_overdue"
  | "incomplete"
  | "withdrawn";

export type TeamJoinMode = "open" | "approval_required";

export type PaymentStatus =
  | "pending"
  | "processing"
  | "successful"
  | "failed"
  | "overdue"
  | "refund_pending"
  | "refunded";

export type SubmissionStatus =
  | "not_started"
  | "draft"
  | "submitted"
  | "locked"
  | "resubmission_available"
  | "deadline_passed";

export type JudgingStatus =
  | "not_assigned"
  | "assigned"
  | "in_progress"
  | "submitted"
  | "conflict"
  | "finalized";

export type AttendanceStatus =
  | "not_checked_in"
  | "checked_in"
  | "already_checked_in"
  | "invalid";

export interface User {
  id: string;
  collegeId: string; // Multi-college extensible architecture
  email: string;
  mobile: string;
  name: string;
  rollNumber?: string;
  role: PlatformRole;
  avatarUrl?: string;
  isVerifiedCollegeUser: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudentProfile {
  id: string;
  userId: string;
  name: string;
  rollNumber: string; // Mandatory
  branch: string; // Mandatory
  year: string; // Mandatory e.g., "1st Year", "2nd Year", "3rd Year", "4th Year"
  profilePhotoUrl?: string;
  facePresenceVerified: boolean;
  technicalSkills: string[];
  nonTechnicalSkills: string[];
  domains: string[];
  githubUrl: string;
  linkedinUrl: string;
  portfolioUrl?: string;
  previousCompetitions?: string[];
  projects?: Array<{
    title: string;
    description: string;
    link?: string;
  }>;
  achievements?: string[];
  certificates?: string[];
  lookingForTeam: boolean;
  updatedAt: string;
}

export interface CompetitionBranding {
  primaryColor: string;
  accentColor: string;
  textColor: string;
  buttonStyle?: string;
  logoText: string;
  logoUrl?: string;
  bannerUrl?: string;
  backgroundImageUrl?: string;
  gradient: string;
}

export interface CompetitionDates {
  registrationReadyDate: string;
  competitionReadyDate: string;
  registrationDeadline: string;
  teamChangeDeadline: string;
  withdrawalDeadline: string;
  paymentDeadline: string;
  startDate: string;
  endDate: string;
}

export interface CompetitionCapacity {
  maxParticipants?: number; // undefined = unlimited
  maxTeams?: number; // undefined = unlimited
  waitlistAcceptanceWindowHours: number;
}

export interface Track {
  id: string;
  competitionId: string;
  name: string;
  description: string;
  color?: string;
}

export interface RegistrationField {
  id: string;
  competitionId: string;
  label: string;
  type: "short_text" | "long_text" | "rich_text" | "dropdown" | "checkbox" | "file_upload";
  options?: string[];
  required: boolean;
  placeholder?: string;
}

export interface PricingConfig {
  isFree: boolean;
  baseTeamFee: number;
  baseTeamMemberCount: number;
  additionalMemberFee: number;
  currency: string;
}

export interface Competition {
  id: string;
  collegeId: string;
  slug: string;
  title: string;
  type: CompetitionType;
  accessCode?: string;
  overview: string;
  description: string;
  branding: CompetitionBranding;
  dates: CompetitionDates;
  capacity: CompetitionCapacity;
  eligibility: {
    verifiedCollegeStudentsOnly: boolean;
    allowedYears?: string[]; // e.g. ["1st Year", "2nd Year", "3rd Year", "4th Year"]
  };
  participationMode: ParticipationMode;
  teamRules: {
    minTeamSize: number;
    maxTeamSize: number;
  };
  pricing: PricingConfig;
  status: CompetitionStatus;
  primaryPublisherId: string;
  createdAt: string;
  updatedAt: string;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledByUserId?: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: "leader" | "member";
  verificationPin: string;
  isVerified: boolean;
  verifiedAt?: string;
  delegatedPermissions: Array<"submission_edits" | "team_invites" | "payment">;
  joinedAt: string;
}

export interface Team {
  id: string;
  competitionId: string;
  name: string;
  code: string; // Permanent code e.g. CA-8492
  leaderId: string;
  trackId: string;
  joinMode: TeamJoinMode;
  description?: string;
  status: TeamStatus;
  minSize: number;
  maxSize: number;
  finalizedAt?: string;
  declarationsAccepted: boolean;
  trackChangeUsed: boolean;
  customFieldResponses?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface TeamJoinRequest {
  id: string;
  teamId: string;
  userId: string;
  competitionId: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  competitionId: string;
  inviterUserId: string;
  inviteeUserId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

export interface TeamRemovalVote {
  id: string;
  teamId: string;
  targetUserId: string;
  initiatedByUserId: string;
  reason: string;
  deadline: string;
  votes: Record<string, "yes" | "no">;
  status: "active" | "passed" | "rejected" | "expired";
  createdAt: string;
}

export interface TrackChangeRequest {
  id: string;
  teamId: string;
  competitionId: string;
  currentTrackId: string;
  requestedTrackId: string;
  reason: string;
  status: "pending" | "approved" | "declined";
  reviewedByUserId?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface TeamLeaderSuccessorNomination {
  teamId: string;
  currentLeaderId: string;
  nominatedSuccessorId?: string;
}

export interface WaitlistEntry {
  id: string;
  competitionId: string;
  userId?: string;
  teamId?: string;
  name: string;
  type: "individual" | "team";
  position: number;
  status: "waiting" | "offered" | "accepted" | "expired" | "admitted_manually";
  offerExpiresAt?: string;
  joinedAt: string;
}

export interface Coupon {
  id: string;
  competitionId: string;
  code: string; // e.g. IEEE100
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxDiscount?: number;
  usageLimit: number;
  usedCount: number;
  expiresAt: string;
  isActive: boolean;
}

export interface FeeWaiver {
  id: string;
  teamId: string;
  competitionId: string;
  issuedByUserId: string;
  type: "full" | "partial" | "custom";
  waiverAmount: number;
  reason: string;
  createdAt: string;
}

export interface PaymentTransaction {
  id: string;
  teamId: string;
  competitionId: string;
  payerUserId: string;
  amount: number;
  baseFee: number;
  additionalMembersFee: number;
  discountAmount: number;
  couponCode?: string;
  waiverAmount?: number;
  status: PaymentStatus;
  transactionId?: string;
  gatewayProvider: string;
  gatewayResponse?: Record<string, any>;
  invoiceNumber: string;
  receiptUrl?: string;
  createdAt: string;
  paidAt?: string;
  refundedAt?: string;
  refundReason?: string;
}

export interface Round {
  id: string;
  competitionId: string;
  roundNumber: number;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  submissionDeadline: string;
  advancementMode: "manual" | "score_based" | "combination";
  isBlindJudging: boolean;
  status: "upcoming" | "active" | "evaluating" | "completed";
}

export interface SubmissionFile {
  id: string;
  name: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
  status: "uploading" | "processing" | "valid" | "invalid" | "security_scan_failed" | "preview_available";
}

export interface Submission {
  id: string;
  roundId: string;
  teamId: string;
  competitionId: string;
  trackId?: string;
  version: number;
  status: SubmissionStatus;
  title: string;
  summary: string;
  data: Record<string, any>;
  files: SubmissionFile[];
  githubUrl?: string;
  demoUrl?: string;
  videoUrl?: string;
  submittedByUserId: string;
  submittedAt?: string;
  updatedAt: string;
}

export interface JudgingCriteria {
  id: string;
  roundId: string;
  competitionId: string;
  name: string;
  description: string;
  weight: number; // 0 to 100
  maxScore: number;
}

export interface JudgeAssignment {
  id: string;
  roundId: string;
  competitionId: string;
  judgeUserId: string;
  teamId: string;
  status: JudgingStatus;
  conflictDeclared?: boolean;
}

export interface JudgingScore {
  id: string;
  assignmentId: string;
  judgeUserId: string;
  teamId: string;
  roundId: string;
  scores: Record<string, number>; // criteriaId -> score
  totalWeightedScore: number;
  comments: string;
  isDraft: boolean;
  submittedAt?: string;
}

export interface AttendanceCheckpoint {
  id: string;
  competitionId: string;
  name: string;
  windowStart: string;
  windowEnd: string;
  location?: string;
  requiredForCertificate: boolean;
}

export interface AttendanceRecord {
  id: string;
  checkpointId: string;
  competitionId: string;
  participantUserId: string;
  teamId: string;
  scannedByUserId: string;
  scannedAt: string;
}

export interface DigitalPass {
  competitionId: string;
  participantUserId: string;
  participantName: string;
  rollNumber: string;
  teamName: string;
  trackName: string;
  secureToken: string;
  issuedAt: string;
}

export interface Certificate {
  id: string;
  competitionId: string;
  userId: string;
  userName: string;
  teamName: string;
  type: "participation" | "finalist" | "winner" | "special_recognition" | "custom";
  title: string;
  subtitle: string;
  issuedDate: string;
  verificationCode: string;
  eligible: boolean;
}

export interface Announcement {
  id: string;
  competitionId: string;
  senderUserId: string;
  senderName: string;
  targetType: "all" | "track" | "round" | "team" | "participant";
  targetId?: string;
  title: string;
  message: string;
  sendWhatsApp: boolean;
  whatsAppDeliveryStatus?: "sent" | "delivered" | "failed";
  createdAt: string;
}

export interface PlatformNotification {
  id: string;
  userId: string;
  competitionId?: string;
  category: "team_activity" | "payment_updates" | "deadline_changes" | "round_updates" | "announcements" | "critical";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface OrganizerMembership {
  id: string;
  competitionId: string;
  userId: string;
  role: CompetitionRole;
  permissions: CompetitionPermission[];
  addedAt: string;
}

export interface Dispute {
  id: string;
  competitionId: string;
  teamId?: string;
  raisedByUserId: string;
  raisedByName: string;
  type: "member_removal" | "team_issue" | "payment_issue" | "registration_issue" | "competition_issue";
  description: string;
  evidenceUrls: string[];
  status: "open" | "under_review" | "resolved" | "dismissed";
  resolution?: string;
  resolvedByUserId?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface AuditLog {
  id: string;
  competitionId?: string;
  actorUserId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  previousValue?: any;
  newValue?: any;
  timestamp: string;
}

export interface CompetitionReview {
  id: string;
  competitionId: string;
  rating: number; // 1 to 5
  positives: string;
  improvements: string; // "What could be improved?"
  isAnonymous: boolean;
  createdAt: string;
}
