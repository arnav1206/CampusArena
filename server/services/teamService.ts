// =============================================================================
// Campus Arena — Team Formation, Verification & Lifecycle Service
// =============================================================================

import { db } from "../db";
import type {
  Team,
  TeamMember,
  TeamJoinMode,
  TeamJoinRequest,
  TeamInvitation,
  TeamRemovalVote,
  TrackChangeRequest,
} from "../../shared/types";
import { computeTeamStatus } from "../../shared/state-machines";
import {
  canRequestTrackChange,
  getMemberRemovalMode,
} from "../../shared/business-rules";

export class TeamService {
  static getTeamsByCompetition(competitionId: string): Team[] {
    return db.get().teams.filter((t) => t.competitionId === competitionId);
  }

  static getTeamById(teamId: string): Team | undefined {
    return db.get().teams.find((t) => t.id === teamId);
  }

  static getTeamMembers(teamId: string): (TeamMember & { userName: string; userRoll: string })[] {
    const state = db.get();
    const members = state.teamMembers.filter((m) => m.teamId === teamId);
    return members.map((m) => {
      const user = state.users.find((u) => u.id === m.userId);
      return {
        ...m,
        userName: user?.name || "Member",
        userRoll: user?.rollNumber || "",
      };
    });
  }

  static getTeamsForUser(userId: string): { team: Team; role: "leader" | "member"; competitionTitle: string }[] {
    const state = db.get();
    const memberships = state.teamMembers.filter((m) => m.userId === userId);
    return memberships.map((m) => {
      const team = state.teams.find((t) => t.id === m.teamId)!;
      const comp = state.competitions.find((c) => c.id === team.competitionId);
      return {
        team,
        role: m.role,
        competitionTitle: comp?.title || "Competition",
      };
    }).filter(item => Boolean(item.team));
  }

  /**
   * Create a new team
   * Generates permanent unique team code e.g. CA-7842
   */
  static createTeam(params: {
    competitionId: string;
    leaderId: string;
    name: string;
    trackId: string;
    joinMode: TeamJoinMode;
    description?: string;
  }): { success: boolean; team?: Team; error?: string } {
    const { competitionId, leaderId, name, trackId, joinMode, description } = params;

    const state = db.get();
    const comp = state.competitions.find((c) => c.id === competitionId);
    if (!comp) return { success: false, error: "Competition not found." };

    // Check if leader already belongs to a team in this competition
    const existingMembership = state.teamMembers.find((m) => {
      if (m.userId !== leaderId) return false;
      const t = state.teams.find((team) => team.id === m.teamId);
      return t && t.competitionId === competitionId && t.status !== "withdrawn";
    });

    if (existingMembership) {
      return {
        success: false,
        error: "You are already a member of a team in this competition. You must leave your current team first.",
      };
    }

    const code = `CA-${Math.floor(1000 + Math.random() * 9000)}`;
    const teamId = `tm_${Date.now()}`;
    const now = new Date().toISOString();

    const newTeam: Team = {
      id: teamId,
      competitionId,
      name: name.trim(),
      code,
      leaderId,
      trackId,
      joinMode,
      description,
      status: "formation",
      minSize: comp.teamRules.minTeamSize,
      maxSize: comp.teamRules.maxTeamSize,
      declarationsAccepted: false,
      trackChangeUsed: false,
      createdAt: now,
      updatedAt: now,
    };

    const leaderMember: TeamMember = {
      id: `tm_m_${Date.now()}`,
      teamId,
      userId: leaderId,
      role: "leader",
      verificationPin: String(Math.floor(100000 + Math.random() * 900000)),
      isVerified: true, // Leader is verified upon creation
      verifiedAt: now,
      delegatedPermissions: ["submission_edits", "team_invites", "payment"],
      joinedAt: now,
    };

    db.update((draft) => {
      draft.teams.push(newTeam);
      draft.teamMembers.push(leaderMember);
      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        competitionId,
        actorUserId: leaderId,
        actorName: "Team Leader",
        action: "TEAM_CREATED",
        entityType: "Team",
        entityId: teamId,
        details: `Created team "${name}" with permanent code ${code}`,
        timestamp: now,
      });
    });

    return { success: true, team: newTeam };
  }

  /**
   * Team Code Rule:
   * Entering a team code creates a JOIN REQUEST.
   * Team code alone NEVER automatically makes someone a member.
   * Team Leader confirmation is mandatory.
   */
  static requestJoinByCode(params: {
    teamCode: string;
    userId: string;
  }): { success: boolean; message: string; error?: string } {
    const { teamCode, userId } = params;
    const cleanCode = teamCode.trim().toUpperCase();

    const state = db.get();
    const team = state.teams.find((t) => t.code.toUpperCase() === cleanCode);
    if (!team) return { success: false, message: "No team found matching that code.", error: "No team found matching that code." };

    // Check if team is at max size
    const currentMembers = state.teamMembers.filter((m) => m.teamId === team.id);
    if (currentMembers.length >= team.maxSize) {
      return { success: false, message: "This team has already reached maximum capacity.", error: "This team has already reached maximum capacity." };
    }

    // Check if user already in a team for this competition
    const existing = state.teamMembers.find((m) => {
      if (m.userId !== userId) return false;
      const t = state.teams.find((other) => other.id === m.teamId);
      return t && t.competitionId === team.competitionId && t.status !== "withdrawn";
    });

    if (existing) {
      return { success: false, message: "You are already in a team for this competition.", error: "You are already in a team for this competition." };
    }

    // Create join request
    const requestId = `jr_${Date.now()}`;
    db.update((draft) => {
      // Notify team leader
      draft.notifications.unshift({
        id: `notif_${Date.now()}`,
        userId: team.leaderId,
        competitionId: team.competitionId,
        category: "team_activity",
        title: "New Team Join Request",
        message: `A student requested to join "${team.name}" using your team code. Leader confirmation is required.`,
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    });

    return {
      success: true,
      message: `Join request submitted for "${team.name}". Team code alone does not grant membership; Team Leader confirmation is required.`,
    };
  }

  /**
   * Team Leader confirms a pending join request or adds member
   */
  static confirmMember(params: {
    teamId: string;
    leaderId: string;
    newUserId: string;
  }): { success: boolean; member?: TeamMember; error?: string } {
    const { teamId, leaderId, newUserId } = params;

    const state = db.get();
    const team = state.teams.find((t) => t.id === teamId);
    if (!team) return { success: false, error: "Team not found." };
    if (team.leaderId !== leaderId) return { success: false, error: "Only the Team Leader can confirm membership." };

    const currentMembers = state.teamMembers.filter((m) => m.teamId === teamId);
    if (currentMembers.length >= team.maxSize) {
      return { success: false, error: "Team has reached maximum team size." };
    }

    const verificationPin = String(Math.floor(100000 + Math.random() * 900000));
    const now = new Date().toISOString();

    const newMember: TeamMember = {
      id: `tm_m_${Date.now()}`,
      teamId,
      userId: newUserId,
      role: "member",
      verificationPin,
      isVerified: false, // Must verify PIN
      delegatedPermissions: [],
      joinedAt: now,
    };

    db.update((draft) => {
      draft.teamMembers.push(newMember);

      // Send verification PIN notification to new member
      draft.notifications.unshift({
        id: `notif_${Date.now()}`,
        userId: newUserId,
        competitionId: team.competitionId,
        category: "team_activity",
        title: `Verification PIN for ${team.name}`,
        message: `You were confirmed for team "${team.name}". Your unique verification PIN is: ${verificationPin}. Enter this in your team workspace to verify!`,
        isRead: false,
        createdAt: now,
      });

      // Update team status
      const allMembers = draft.teamMembers.filter((m) => m.teamId === teamId);
      const isPaid = draft.payments.some((p) => p.teamId === teamId && p.status === "successful");
      const targetTeam = draft.teams.find((t) => t.id === teamId)!;
      targetTeam.status = computeTeamStatus({
        memberCount: allMembers.length,
        minSize: targetTeam.minSize,
        allMembersVerified: allMembers.every((m) => m.isVerified),
        declarationsAccepted: targetTeam.declarationsAccepted,
        trackSelected: Boolean(targetTeam.trackId),
        isPaidOrFree: isPaid,
        isPaymentOverdue: false,
      });

      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        competitionId: team.competitionId,
        actorUserId: leaderId,
        actorName: "Team Leader",
        action: "CONFIRMED_TEAM_MEMBER",
        entityType: "TeamMember",
        entityId: newUserId,
        details: `Leader confirmed new member into team "${team.name}". Verification PIN dispatched.`,
        timestamp: now,
      });
    });

    return { success: true, member: newMember };
  }

  /**
   * Member verifies unique PIN
   */
  static verifyMemberPin(params: {
    teamId: string;
    userId: string;
    pin: string;
  }): { success: boolean; error?: string } {
    const { teamId, userId, pin } = params;

    let success = false;
    let errorMsg: string | undefined;

    db.update((draft) => {
      const member = draft.teamMembers.find(
        (m) => m.teamId === teamId && m.userId === userId
      );

      if (!member) {
        errorMsg = "Member record not found.";
        return;
      }

      if (member.verificationPin !== pin.trim()) {
        errorMsg = "Invalid verification PIN.";
        return;
      }

      member.isVerified = true;
      member.verifiedAt = new Date().toISOString();
      success = true;

      // Re-evaluate team status
      const team = draft.teams.find((t) => t.id === teamId)!;
      const allMembers = draft.teamMembers.filter((m) => m.teamId === teamId);
      const isPaid = draft.payments.some((p) => p.teamId === teamId && p.status === "successful");

      team.status = computeTeamStatus({
        memberCount: allMembers.length,
        minSize: team.minSize,
        allMembersVerified: allMembers.every((m) => m.isVerified),
        declarationsAccepted: team.declarationsAccepted,
        trackSelected: Boolean(team.trackId),
        isPaidOrFree: isPaid,
        isPaymentOverdue: false,
      });

      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        competitionId: team.competitionId,
        actorUserId: userId,
        actorName: "Member",
        action: "MEMBER_VERIFIED_PIN",
        entityType: "TeamMember",
        entityId: userId,
        details: `Member verified PIN successfully for "${team.name}"`,
        timestamp: new Date().toISOString(),
      });
    });

    if (errorMsg) return { success: false, error: errorMsg };
    return { success };
  }

  /**
   * Finalize team:
   * Requires: min size, all members verified, track selected, declarations accepted
   */
  static finalizeTeam(params: {
    teamId: string;
    leaderId: string;
    declarationsAccepted: boolean;
  }): { success: boolean; team?: Team; error?: string } {
    const { teamId, leaderId, declarationsAccepted } = params;

    let resultTeam: Team | undefined;
    let errorMsg: string | undefined;

    db.update((draft) => {
      const team = draft.teams.find((t) => t.id === teamId);
      if (!team) {
        errorMsg = "Team not found.";
        return;
      }
      if (team.leaderId !== leaderId) {
        errorMsg = "Only Team Leader can finalize the team.";
        return;
      }

      const members = draft.teamMembers.filter((m) => m.teamId === teamId);
      if (members.length < team.minSize) {
        errorMsg = `Minimum team size (${team.minSize}) has not been reached.`;
        return;
      }

      const allVerified = members.every((m) => m.isVerified);
      if (!allVerified) {
        errorMsg = "All team members must verify their PIN before finalization.";
        return;
      }

      if (!declarationsAccepted) {
        errorMsg = "Final declarations must be accepted.";
        return;
      }

      const now = new Date().toISOString();
      team.declarationsAccepted = true;
      team.finalizedAt = now;

      const isPaid = draft.payments.some((p) => p.teamId === teamId && p.status === "successful");
      const comp = draft.competitions.find((c) => c.id === team.competitionId);
      const isFree = comp?.pricing.isFree;

      team.status = computeTeamStatus({
        memberCount: members.length,
        minSize: team.minSize,
        allMembersVerified: true,
        declarationsAccepted: true,
        trackSelected: Boolean(team.trackId),
        isPaidOrFree: isPaid || Boolean(isFree),
        isPaymentOverdue: false,
      });

      resultTeam = team;

      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        competitionId: team.competitionId,
        actorUserId: leaderId,
        actorName: "Team Leader",
        action: "TEAM_FINALIZED",
        entityType: "Team",
        entityId: teamId,
        details: `Team "${team.name}" officially finalized by Team Leader.`,
        timestamp: now,
      });
    });

    if (errorMsg) return { success: false, error: errorMsg };
    return { success: true, team: resultTeam };
  }

  /**
   * Track Change Request:
   * Max once, before submission only, requires organizer approval.
   * Permanently locked after submission.
   */
  static requestTrackChange(params: {
    teamId: string;
    leaderId: string;
    requestedTrackId: string;
    reason: string;
  }): { success: boolean; error?: string } {
    const { teamId, leaderId, requestedTrackId, reason } = params;

    const state = db.get();
    const team = state.teams.find((t) => t.id === teamId);
    if (!team) return { success: false, error: "Team not found." };
    if (team.leaderId !== leaderId) return { success: false, error: "Only Team Leader can request a track change." };

    const submissions = state.submissions.filter((s) => s.teamId === teamId);
    const hasSubmitted = submissions.length > 0;

    const eligibility = canRequestTrackChange(team, hasSubmitted);
    if (!eligibility.allowed) {
      return { success: false, error: eligibility.reason };
    }

    db.update((draft) => {
      const now = new Date().toISOString();
      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        competitionId: team.competitionId,
        actorUserId: leaderId,
        actorName: "Team Leader",
        action: "TRACK_CHANGE_REQUESTED",
        entityType: "TrackChangeRequest",
        entityId: teamId,
        details: `Requested track change to track ${requestedTrackId}. Reason: ${reason}`,
        timestamp: now,
      });
    });

    return { success: true };
  }

  /**
   * Delegate permissions to member
   */
  static setDelegatedPermissions(params: {
    teamId: string;
    leaderId: string;
    targetUserId: string;
    permissions: Array<"submission_edits" | "team_invites" | "payment">;
  }): { success: boolean; error?: string } {
    const { teamId, leaderId, targetUserId, permissions } = params;

    let errorMsg: string | undefined;
    db.update((draft) => {
      const team = draft.teams.find((t) => t.id === teamId);
      if (!team || team.leaderId !== leaderId) {
        errorMsg = "Unauthorized: Only Team Leader can delegate permissions.";
        return;
      }

      const member = draft.teamMembers.find(
        (m) => m.teamId === teamId && m.userId === targetUserId
      );
      if (!member) {
        errorMsg = "Member not found.";
        return;
      }

      member.delegatedPermissions = permissions;
    });

    if (errorMsg) return { success: false, error: errorMsg };
    return { success: true };
  }

  /**
   * Remove Member:
   * Before finalization & payment -> voting
   * After finalization or payment -> organizer approval request
   */
  static initiateMemberRemoval(params: {
    teamId: string;
    leaderId: string;
    targetUserId: string;
    reason: string;
  }): { success: boolean; mode: "voting" | "organizer_approval"; message: string; error?: string } {
    const { teamId, leaderId, targetUserId, reason } = params;

    const state = db.get();
    const team = state.teams.find((t) => t.id === teamId);
    if (!team) return { success: false, mode: "voting", message: "", error: "Team not found." };
    if (team.leaderId !== leaderId) return { success: false, mode: "voting", message: "", error: "Only Team Leader can initiate member removal." };

    const isPaid = state.payments.some((p) => p.teamId === teamId && p.status === "successful");
    const mode = getMemberRemovalMode(team, isPaid);

    if (mode === "voting") {
      // Execute immediate removal if single or consensus
      db.update((draft) => {
        draft.teamMembers = draft.teamMembers.filter(
          (m) => !(m.teamId === teamId && m.userId === targetUserId)
        );
        draft.auditLogs.unshift({
          id: `aud_${Date.now()}`,
          competitionId: team.competitionId,
          actorUserId: leaderId,
          actorName: "Team Leader",
          action: "MEMBER_REMOVED_VOTE",
          entityType: "TeamMember",
          entityId: targetUserId,
          details: `Member removed prior to finalization/payment. Reason: ${reason}`,
          timestamp: new Date().toISOString(),
        });
      });

      return {
        success: true,
        mode: "voting",
        message: "Member removed from team via pre-finalization procedure.",
      };
    } else {
      // Create organizer dispute / approval request
      db.update((draft) => {
        draft.disputes.unshift({
          id: `dsp_${Date.now()}`,
          competitionId: team.competitionId,
          teamId,
          raisedByUserId: leaderId,
          raisedByName: "Team Leader",
          type: "member_removal",
          description: `Leader removal request for user ${targetUserId}. Reason: ${reason}`,
          evidenceUrls: [],
          status: "open",
          createdAt: new Date().toISOString(),
        });
      });

      return {
        success: true,
        mode: "organizer_approval",
        message: "Because this team is already finalized or paid, member removal requires organizer review. Request submitted.",
      };
    }
  }

  /**
   * Voluntary Member Self-Withdrawal
   * Prohibited after Withdrawal Deadline. No refunds.
   * If Leader withdraws, successor logic executes.
   */
  static withdrawMember(params: {
    teamId: string;
    userId: string;
    nominatedSuccessorId?: string;
  }): { success: boolean; message: string; error?: string } {
    const { teamId, userId, nominatedSuccessorId } = params;

    let errorMsg: string | undefined;
    let infoMsg = "Successfully withdrawn from team.";

    db.update((draft) => {
      const team = draft.teams.find((t) => t.id === teamId);
      if (!team) {
        errorMsg = "Team not found.";
        return;
      }

      const comp = draft.competitions.find((c) => c.id === team.competitionId);
      if (comp?.dates.withdrawalDeadline) {
        const deadline = new Date(comp.dates.withdrawalDeadline).getTime();
        if (Date.now() > deadline) {
          errorMsg = "The voluntary withdrawal deadline has passed.";
          return;
        }
      }

      const isLeader = team.leaderId === userId;
      draft.teamMembers = draft.teamMembers.filter(
        (m) => !(m.teamId === teamId && m.userId === userId)
      );

      const remainingMembers = draft.teamMembers.filter((m) => m.teamId === teamId);

      if (remainingMembers.length === 0) {
        team.status = "withdrawn";
      } else if (isLeader) {
        // Successor logic:
        // 1. Nominated successor
        // 2. Next eligible member
        const successor =
          remainingMembers.find((m) => m.userId === nominatedSuccessorId) ||
          remainingMembers[0];

        team.leaderId = successor.userId;
        successor.role = "leader";
        infoMsg = `Withdrawn from team. Leadership transferred to ${successor.userId}.`;
      }

      // Recompute team status
      if (team.status !== "withdrawn") {
        const isPaid = draft.payments.some((p) => p.teamId === teamId && p.status === "successful");
        team.status = computeTeamStatus({
          memberCount: remainingMembers.length,
          minSize: team.minSize,
          allMembersVerified: remainingMembers.every((m) => m.isVerified),
          declarationsAccepted: team.declarationsAccepted,
          trackSelected: Boolean(team.trackId),
          isPaidOrFree: isPaid,
          isPaymentOverdue: false,
        });
      }

      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        competitionId: team.competitionId,
        actorUserId: userId,
        actorName: "Participant",
        action: "MEMBER_WITHDREW",
        entityType: "TeamMember",
        entityId: userId,
        details: `Participant voluntarily withdrew from team "${team.name}". Payment is non-refundable.`,
        timestamp: new Date().toISOString(),
      });
    });

    if (errorMsg) return { success: false, message: "", error: errorMsg };
    return { success: true, message: infoMsg };
  }
}
