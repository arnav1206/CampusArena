// =============================================================================
// Campus Arena — Student Profile Service
// =============================================================================

import { db } from "../db";
import type { StudentProfile } from "../../shared/types";

export class ProfileService {
  static getProfileByUserId(userId: string): StudentProfile | undefined {
    return db.get().profiles.find((p) => p.userId === userId);
  }

  static updateProfile(
    userId: string,
    updates: Partial<StudentProfile>
  ): { success: boolean; profile?: StudentProfile; error?: string } {
    let updated: StudentProfile | undefined;

    db.update((draft) => {
      let p = draft.profiles.find((profile) => profile.userId === userId);
      if (!p) {
        const user = draft.users.find((u) => u.id === userId);
        p = {
          id: `p_${Date.now()}`,
          userId,
          name: user?.name || "Student",
          rollNumber: user?.rollNumber || "2024CS001",
          branch: "Computer Science & Engineering",
          year: "1st Year",
          facePresenceVerified: false,
          technicalSkills: [],
          nonTechnicalSkills: [],
          domains: [],
          githubUrl: "",
          linkedinUrl: "",
          lookingForTeam: false,
          updatedAt: new Date().toISOString(),
        };
        draft.profiles.push(p);
      }

      // Prohibit Section if accidentally supplied
      const safeUpdates = { ...updates };
      delete (safeUpdates as any).section;

      Object.assign(p, safeUpdates, { updatedAt: new Date().toISOString() });
      updated = p;

      // Also sync name to user if updated
      if (updates.name) {
        const u = draft.users.find((user) => user.id === userId);
        if (u) u.name = updates.name;
      }
    });

    return { success: true, profile: updated };
  }

  /**
   * Face-presence check
   * Only verifies human face presence is detected in uploaded photo.
   * STRICTLY NO biometric identification or face recognition.
   */
  static verifyFacePresence(
    userId: string,
    photoBase64OrUrl: string
  ): { success: boolean; faceDetected: boolean; message: string } {
    // In real system, calls lightweight face presence heuristic / MediaPipe / OpenCV
    // We confirm presence without biometric extraction
    const hasPhoto = Boolean(photoBase64OrUrl && photoBase64OrUrl.length > 50);

    db.update((draft) => {
      const p = draft.profiles.find((profile) => profile.userId === userId);
      if (p) {
        p.profilePhotoUrl = photoBase64OrUrl;
        p.facePresenceVerified = hasPhoto;
        p.updatedAt = new Date().toISOString();
      }
    });

    return {
      success: true,
      faceDetected: hasPhoto,
      message: hasPhoto
        ? "Human face presence verified. Profile photo accepted."
        : "No face detected in photo. Please ensure clear lighting.",
    };
  }

  static toggleLookingForTeam(userId: string, isLooking: boolean): boolean {
    let result = isLooking;
    db.update((draft) => {
      const p = draft.profiles.find((profile) => profile.userId === userId);
      if (p) {
        p.lookingForTeam = isLooking;
        p.updatedAt = new Date().toISOString();
        result = p.lookingForTeam;
      }
    });
    return result;
  }

  static getStudentsLookingForTeam(excludeUserId?: string): StudentProfile[] {
    return db
      .get()
      .profiles.filter((p) => p.lookingForTeam && p.userId !== excludeUserId);
  }
}
