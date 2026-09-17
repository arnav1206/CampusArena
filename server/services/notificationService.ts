// =============================================================================
// Campus Arena — Notifications & WhatsApp Integration Service
// =============================================================================

import { db } from "../db/index.js";
import type {
  Announcement,
  PlatformNotification,
} from "../../shared/types.js";

export class NotificationService {
  static getNotificationsForUser(userId: string): PlatformNotification[] {
    return db
      .get()
      .notifications.filter((n) => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  static markAsRead(notificationId: string) {
    db.update((draft) => {
      const n = draft.notifications.find((notif) => notif.id === notificationId);
      if (n) n.isRead = true;
    });
  }

  static markAllAsRead(userId: string) {
    db.update((draft) => {
      draft.notifications
        .filter((n) => n.userId === userId)
        .forEach((n) => {
          n.isRead = true;
        });
    });
  }

  /** Platform-wide notice used by the administrator notification centre. */
  static broadcastPlatformNotice(params: {
    senderUserId: string;
    title: string;
    message: string;
    targetRole?: "all" | "student" | "organizer" | "faculty" | "judge";
  }): { recipientCount: number } {
    const title = params.title.trim();
    const message = params.message.trim();
    if (!title || !message) throw new Error("A title and message are required.");
    const now = new Date().toISOString();
    let recipientCount = 0;
    db.update((draft) => {
      const recipients = draft.users.filter((user) =>
        user.id !== params.senderUserId && (params.targetRole || "all") === "all" ||
        user.id !== params.senderUserId && user.role === params.targetRole
      );
      recipientCount = recipients.length;
      recipients.forEach((recipient, index) => draft.notifications.unshift({
        id: `notif_${Date.now()}_${index}_${recipient.id}`,
        userId: recipient.id,
        category: "announcements",
        title,
        message,
        isRead: false,
        createdAt: now,
      }));
      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        actorUserId: params.senderUserId,
        actorName: "Platform Admin",
        action: "PLATFORM_NOTICE_BROADCAST",
        entityType: "PlatformNotification",
        entityId: `notice_${Date.now()}`,
        details: `Broadcast \"${title}\" to ${recipientCount} ${params.targetRole || "all"} users.`,
        timestamp: now,
      });
    });
    return { recipientCount };
  }

  static getAnnouncementsByCompetition(competitionId: string): Announcement[] {
    return db
      .get()
      .announcements.filter((a) => a.competitionId === competitionId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Broadcast Announcement with Platform Notification & WhatsApp Business API Abstraction
   */
  static broadcastAnnouncement(params: {
    competitionId: string;
    senderUserId: string;
    targetType: Announcement["targetType"];
    targetId?: string;
    title: string;
    message: string;
    sendWhatsApp: boolean;
  }): Announcement {
    const { competitionId, senderUserId, targetType, targetId, title, message, sendWhatsApp } = params;
    const state = db.get();
    const sender = state.users.find((u) => u.id === senderUserId);

    const now = new Date().toISOString();
    const announcement: Announcement = {
      id: `ann_${Date.now()}`,
      competitionId,
      senderUserId,
      senderName: sender?.name || "Competition Organizer",
      targetType,
      targetId,
      title,
      message,
      sendWhatsApp,
      whatsAppDeliveryStatus: sendWhatsApp ? "delivered" : undefined,
      createdAt: now,
    };

    db.update((draft) => {
      draft.announcements.unshift(announcement);

      // Identify target recipient users
      let targetUserIds: string[] = [];
      const compTeams = draft.teams.filter((t) => t.competitionId === competitionId);

      if (targetType === "all") {
        const members = draft.teamMembers.filter((m) =>
          compTeams.some((t) => t.id === m.teamId)
        );
        targetUserIds = Array.from(new Set(members.map((m) => m.userId)));
      } else if (targetType === "team" && targetId) {
        const members = draft.teamMembers.filter((m) => m.teamId === targetId);
        targetUserIds = members.map((m) => m.userId);
      } else if (targetType === "participant" && targetId) {
        targetUserIds = [targetId];
      } else if (targetType === "track" && targetId) {
        const trackTeams = compTeams.filter((t) => t.trackId === targetId);
        const members = draft.teamMembers.filter((m) =>
          trackTeams.some((t) => t.id === m.teamId)
        );
        targetUserIds = Array.from(new Set(members.map((m) => m.userId)));
      }

      // Dispatch platform in-app notifications
      for (const uid of targetUserIds) {
        draft.notifications.unshift({
          id: `notif_${Date.now()}_${uid}`,
          userId: uid,
          competitionId,
          category: "announcements",
          title: `Announcement: ${title}`,
          message,
          isRead: false,
          createdAt: now,
        });
      }

      // If WhatsApp enabled, simulate dispatch via WhatsApp Business Provider
      if (sendWhatsApp) {
        console.log(
          `[WHATSAPP_API] Simulated message dispatched to ${targetUserIds.length} mobile devices for "${title}"`
        );
      }

      draft.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        competitionId,
        actorUserId: senderUserId,
        actorName: sender?.name || "Organizer",
        action: "ANNOUNCEMENT_BROADCAST",
        entityType: "Announcement",
        entityId: announcement.id,
        details: `Broadcast "${title}" to target ${targetType} (Total Recipients: ${targetUserIds.length}). WhatsApp: ${sendWhatsApp}`,
        timestamp: now,
      });
    });

    return announcement;
  }
}
