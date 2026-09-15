// =============================================================================
// Campus Arena — Comprehensive API Routing Layer
// =============================================================================

import { Router, type Request, type Response } from "express";
import { AuthService } from "./services/authService";
import { ProfileService } from "./services/profileService";
import { CompetitionService } from "./services/competitionService";
import { TeamService } from "./services/teamService";
import { PaymentService } from "./services/paymentService";
import { SubmissionService } from "./services/submissionService";
import { JudgingService } from "./services/judgingService";
import { AttendanceService } from "./services/attendanceService";
import { CertificateService } from "./services/certificateService";
import { NotificationService } from "./services/notificationService";
import { AdminService } from "./services/adminService";
import { db } from "./db";

export const apiRouter = Router();

// -----------------------------------------------------------------------------
// 1. Authentication & Role Management
// -----------------------------------------------------------------------------
apiRouter.post("/auth/otp/request", async (req: Request, res: Response) => {
  const { identifier, type } = req.body;
  const result = await AuthService.requestOtp(identifier, type);
  res.json(result);
});

apiRouter.post("/auth/otp/verify", (req: Request, res: Response) => {
  const { identifier, code } = req.body;
  const result = AuthService.verifyOtp(identifier, code);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

apiRouter.post("/auth/dual-otp/request", async (req: Request, res: Response) => {
  const { email, mobile } = req.body;
  if (!email || !mobile) {
    return res.status(400).json({ success: false, error: "Both email and mobile number are required." });
  }
  const result = await AuthService.requestDualOtp(email, mobile);
  res.json(result);
});

apiRouter.post("/auth/dual-otp/verify", (req: Request, res: Response) => {
  const { email, emailOtp, mobile, mobileOtp } = req.body;
  if (!email || !emailOtp || !mobile || !mobileOtp) {
    return res.status(400).json({ success: false, error: "All verification fields are required." });
  }
  const result = AuthService.verifyDualOtp({ email, emailOtp, mobile, mobileOtp });
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

apiRouter.post("/auth/register", (req: Request, res: Response) => {
  const result = AuthService.registerStudent(req.body);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

apiRouter.post("/auth/recover", (req: Request, res: Response) => {
  const result = AuthService.recoverAccount(req.body);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

apiRouter.post("/auth/switch-role", (req: Request, res: Response) => {
  const { userId, role } = req.body;
  const user = AuthService.switchUserRole(userId, role);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ success: true, user });
});

apiRouter.get("/auth/me", (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || "";
  if (!userId) return res.status(400).json({ error: "userId is required" });
  const user = db.get().users.find((u) => u.id === userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});

apiRouter.get("/users", (_req: Request, res: Response) => {
  res.json({ users: db.get().users });
});


// -----------------------------------------------------------------------------
// 2. Student Profile & Face Verification
// -----------------------------------------------------------------------------
apiRouter.get("/profile/:userId", (req: Request, res: Response) => {
  const profile = ProfileService.getProfileByUserId(req.params.userId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  res.json({ profile });
});

apiRouter.post("/profile/update", (req: Request, res: Response) => {
  const { userId, ...updates } = req.body;
  const result = ProfileService.updateProfile(userId, updates);
  res.json(result);
});

apiRouter.post("/profile/face-check", (req: Request, res: Response) => {
  const { userId, photoBase64 } = req.body;
  const result = ProfileService.verifyFacePresence(userId, photoBase64);
  res.json(result);
});

apiRouter.post("/profile/looking-for-team", (req: Request, res: Response) => {
  const { userId, isLooking } = req.body;
  const status = ProfileService.toggleLookingForTeam(userId, isLooking);
  res.json({ success: true, lookingForTeam: status });
});

apiRouter.get("/teammates/candidates", (req: Request, res: Response) => {
  const excludeUserId = req.query.exclude as string | undefined;
  const candidates = ProfileService.getStudentsLookingForTeam(excludeUserId);
  res.json({ candidates });
});

// -----------------------------------------------------------------------------
// 3. Competitions & Readiness
// -----------------------------------------------------------------------------
apiRouter.get("/competitions", (req: Request, res: Response) => {
  const activeOnly = req.query.active === "true";
  const competitions = CompetitionService.getAllCompetitions(activeOnly);
  res.json({ competitions });
});

apiRouter.get("/competitions/:id", (req: Request, res: Response) => {
  const comp = CompetitionService.getCompetitionById(req.params.id);
  if (!comp) return res.status(404).json({ error: "Competition not found" });
  const tracks = CompetitionService.getTracks(comp.id);
  const fields = CompetitionService.getRegistrationFields(comp.id);
  const readiness = CompetitionService.getReadiness(comp.id);
  const capacity = CompetitionService.getCapacityMetrics(comp.id);
  res.json({ competition: comp, tracks, fields, readiness, capacity });
});

apiRouter.post("/competitions/draft", (req: Request, res: Response) => {
  const { publisherId, competition } = req.body;
  try {
    const saved = CompetitionService.createOrUpdateDraft(publisherId || "u_organizer", competition);
    res.json({ success: true, competition: saved });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post("/competitions/:id/status", (req: Request, res: Response) => {
  const { status, userId } = req.body;
  const result = CompetitionService.setStatus(req.params.id, status, userId || "u_organizer");
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

apiRouter.post("/competitions/:id/cancel", (req: Request, res: Response) => {
  const { userId, reason } = req.body;
  const result = CompetitionService.cancelCompetition(req.params.id, userId, reason);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

// -----------------------------------------------------------------------------
// 4. Teams & Verification PINs
// -----------------------------------------------------------------------------
apiRouter.get("/competitions/:id/teams", (req: Request, res: Response) => {
  const teams = TeamService.getTeamsByCompetition(req.params.id);
  res.json({ teams });
});

apiRouter.get("/teams/:id", (req: Request, res: Response) => {
  const team = TeamService.getTeamById(req.params.id);
  if (!team) return res.status(404).json({ error: "Team not found" });
  const members = TeamService.getTeamMembers(team.id);
  res.json({ team, members });
});

apiRouter.get("/users/:userId/teams", (req: Request, res: Response) => {
  const teams = TeamService.getTeamsForUser(req.params.userId);
  res.json({ teams });
});

apiRouter.post("/teams/create", (req: Request, res: Response) => {
  const result = TeamService.createTeam(req.body);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

apiRouter.post("/teams/join-by-code", (req: Request, res: Response) => {
  const result = TeamService.requestJoinByCode(req.body);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

apiRouter.post("/teams/:id/confirm-member", (req: Request, res: Response) => {
  const { leaderId, newUserId } = req.body;
  const result = TeamService.confirmMember({
    teamId: req.params.id,
    leaderId,
    newUserId,
  });
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

apiRouter.post("/teams/:id/verify-pin", (req: Request, res: Response) => {
  const { userId, pin } = req.body;
  const result = TeamService.verifyMemberPin({
    teamId: req.params.id,
    userId,
    pin,
  });
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

apiRouter.post("/teams/:id/finalize", (req: Request, res: Response) => {
  const { leaderId, declarationsAccepted } = req.body;
  const result = TeamService.finalizeTeam({
    teamId: req.params.id,
    leaderId,
    declarationsAccepted,
  });
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

apiRouter.post("/teams/:id/track-change", (req: Request, res: Response) => {
  const { leaderId, requestedTrackId, reason } = req.body;
  const result = TeamService.requestTrackChange({
    teamId: req.params.id,
    leaderId,
    requestedTrackId,
    reason,
  });
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

apiRouter.post("/teams/:id/delegate-permissions", (req: Request, res: Response) => {
  const { leaderId, targetUserId, permissions } = req.body;
  const result = TeamService.setDelegatedPermissions({
    teamId: req.params.id,
    leaderId,
    targetUserId,
    permissions,
  });
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

apiRouter.post("/teams/:id/remove-member", (req: Request, res: Response) => {
  const { leaderId, targetUserId, reason } = req.body;
  const result = TeamService.initiateMemberRemoval({
    teamId: req.params.id,
    leaderId,
    targetUserId,
    reason,
  });
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

apiRouter.post("/teams/:id/withdraw", (req: Request, res: Response) => {
  const { userId, nominatedSuccessorId } = req.body;
  const result = TeamService.withdrawMember({
    teamId: req.params.id,
    userId,
    nominatedSuccessorId,
  });
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

// -----------------------------------------------------------------------------
// 5. Payments, Terms & Coupons
// -----------------------------------------------------------------------------
apiRouter.post("/payments/checkout-summary", (req: Request, res: Response) => {
  try {
    const summary = PaymentService.calculateCheckout(req.body);
    res.json(summary);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post("/payments/process", (req: Request, res: Response) => {
  const result = PaymentService.processPayment(req.body);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

apiRouter.get("/competitions/:id/coupons", (req: Request, res: Response) => {
  const coupons = PaymentService.getCouponsByCompetition(req.params.id);
  res.json({ coupons });
});

apiRouter.post("/competitions/:id/coupons/validate", (req: Request, res: Response) => {
  const { code } = req.body;
  const result = PaymentService.validateCoupon(req.params.id, code);
  if (!result.valid) return res.status(400).json(result);
  res.json(result);
});

apiRouter.post("/competitions/:id/coupons", (req: Request, res: Response) => {
  const coupon = PaymentService.createCoupon(req.body);
  res.json({ success: true, coupon });
});

apiRouter.post("/teams/:id/waiver", (req: Request, res: Response) => {
  const { competitionId, issuedByUserId, type, waiverAmount, reason } = req.body;
  const result = PaymentService.issueWaiver({
    teamId: req.params.id,
    competitionId,
    issuedByUserId,
    type,
    waiverAmount,
    reason,
  });
  res.json(result);
});

apiRouter.get("/competitions/:id/payments", (req: Request, res: Response) => {
  const payments = PaymentService.getPaymentsByCompetition(req.params.id);
  res.json({ payments });
});

// -----------------------------------------------------------------------------
// 6. Rounds & Submissions
// -----------------------------------------------------------------------------
apiRouter.get("/competitions/:id/rounds", (req: Request, res: Response) => {
  const rounds = SubmissionService.getRoundsByCompetition(req.params.id);
  res.json({ rounds });
});

apiRouter.get("/rounds/:id/submissions", (req: Request, res: Response) => {
  const submissions = SubmissionService.getSubmissionsByRound(req.params.id);
  res.json({ submissions });
});

apiRouter.get("/teams/:id/submissions", (req: Request, res: Response) => {
  const submissions = SubmissionService.getSubmissionsByTeam(req.params.id);
  res.json({ submissions });
});

apiRouter.post("/submissions/submit", (req: Request, res: Response) => {
  const result = SubmissionService.submitWork(req.body);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

apiRouter.post("/rounds/:id/extend-deadline", (req: Request, res: Response) => {
  const { organizerUserId, newDeadline } = req.body;
  const result = SubmissionService.extendRoundDeadline({
    roundId: req.params.id,
    organizerUserId,
    newDeadline,
  });
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

// -----------------------------------------------------------------------------
// 7. Judging
// -----------------------------------------------------------------------------
apiRouter.get("/rounds/:id/criteria", (req: Request, res: Response) => {
  const criteria = JudgingService.getCriteriaByRound(req.params.id);
  res.json({ criteria });
});

apiRouter.get("/judges/:id/assignments", (req: Request, res: Response) => {
  const assignments = JudgingService.getAssignmentsForJudge(req.params.id);
  res.json({ assignments });
});

apiRouter.post("/judging/evaluate", (req: Request, res: Response) => {
  const result = JudgingService.submitEvaluation(req.body);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

apiRouter.post("/judging/conflict", (req: Request, res: Response) => {
  const { assignmentId, judgeUserId, reason } = req.body;
  const success = JudgingService.declareConflict(assignmentId, judgeUserId, reason);
  res.json({ success });
});

// -----------------------------------------------------------------------------
// 8. Attendance & Digital Event Pass
// -----------------------------------------------------------------------------
apiRouter.get("/competitions/:id/checkpoints", (req: Request, res: Response) => {
  const checkpoints = AttendanceService.getCheckpointsByCompetition(req.params.id);
  res.json({ checkpoints });
});

apiRouter.get("/competitions/:id/pass/:userId", (req: Request, res: Response) => {
  const pass = AttendanceService.getDigitalPass({
    competitionId: req.params.id,
    userId: req.params.userId,
  });
  if (!pass) return res.status(404).json({ error: "Digital Pass not found" });
  res.json({ pass });
});

apiRouter.post("/attendance/scan", (req: Request, res: Response) => {
  const { checkpointId, qrToken, scannerUserId } = req.body;
  const result = AttendanceService.scanAndRecordCheckIn({
    checkpointId,
    qrToken,
    scannerUserId,
  });
  res.json(result);
});

apiRouter.get("/competitions/:id/attendance", (req: Request, res: Response) => {
  const records = AttendanceService.getAttendanceRecords(req.params.id);
  res.json({ records });
});

// -----------------------------------------------------------------------------
// 9. Certificates & Completed Showcase
// -----------------------------------------------------------------------------
apiRouter.get("/users/:userId/certificates", (req: Request, res: Response) => {
  const certificates = CertificateService.getCertificatesForUser(req.params.userId);
  res.json({ certificates });
});

apiRouter.get("/competitions/:id/certificates", (req: Request, res: Response) => {
  const certificates = CertificateService.getCertificatesByCompetition(req.params.id);
  res.json({ certificates });
});

apiRouter.get("/competitions/:id/eligibility/:userId", (req: Request, res: Response) => {
  const result = CertificateService.checkEligibility(req.params.id, req.params.userId);
  res.json(result);
});

apiRouter.post("/certificates/issue", (req: Request, res: Response) => {
  const cert = CertificateService.issueCertificate(req.body);
  res.json({ success: true, certificate: cert });
});

apiRouter.post("/competitions/:id/reviews", (req: Request, res: Response) => {
  const review = CertificateService.submitReview({
    competitionId: req.params.id,
    ...req.body,
  });
  res.json({ success: true, review });
});

apiRouter.get("/competitions/:id/reviews", (req: Request, res: Response) => {
  const reviews = CertificateService.getShowcaseReviews(req.params.id);
  res.json({ reviews });
});

// -----------------------------------------------------------------------------
// 10. Notifications & Announcements
// -----------------------------------------------------------------------------
apiRouter.get("/users/:userId/notifications", (req: Request, res: Response) => {
  const notifications = NotificationService.getNotificationsForUser(req.params.userId);
  res.json({ notifications });
});

apiRouter.post("/notifications/:id/read", (req: Request, res: Response) => {
  NotificationService.markAsRead(req.params.id);
  res.json({ success: true });
});

apiRouter.post("/users/:userId/notifications/read-all", (req: Request, res: Response) => {
  NotificationService.markAllAsRead(req.params.userId);
  res.json({ success: true });
});

apiRouter.get("/competitions/:id/announcements", (req: Request, res: Response) => {
  const announcements = NotificationService.getAnnouncementsByCompetition(req.params.id);
  res.json({ announcements });
});

apiRouter.post("/competitions/:id/announcements/broadcast", (req: Request, res: Response) => {
  const announcement = NotificationService.broadcastAnnouncement({
    competitionId: req.params.id,
    ...req.body,
  });
  res.json({ success: true, announcement });
});

// -----------------------------------------------------------------------------
// 11. Admin Portal, Disputes & Audit Logs
// -----------------------------------------------------------------------------
apiRouter.get("/admin/metrics", (_req: Request, res: Response) => {
  const metrics = AdminService.getPlatformMetrics();
  res.json({ metrics });
});

apiRouter.get("/admin/disputes", (req: Request, res: Response) => {
  const compId = req.query.competitionId as string | undefined;
  const disputes = AdminService.getDisputes(compId);
  res.json({ disputes });
});

apiRouter.post("/admin/disputes/resolve", (req: Request, res: Response) => {
  const result = AdminService.resolveDispute(req.body);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

apiRouter.get("/admin/audit-logs", (req: Request, res: Response) => {
  const logs = AdminService.getAuditLogs({
    competitionId: req.query.competitionId as string,
    actorUserId: req.query.actorUserId as string,
    action: req.query.action as string,
    limit: Number(req.query.limit) || 100,
  });
  res.json({ logs });
});
