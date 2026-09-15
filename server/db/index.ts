// =============================================================================
// Campus Arena — SQLite Persistent Database
// Replaces the JSON file store with a real SQLite database.
// Tables are created automatically on first run.
// No seed/fake data — all data comes from real user registrations.
// =============================================================================

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = process.env.VERCEL
  ? path.resolve("/tmp", "campus_arena_data")
  : path.resolve(__dirname, "..", "data");
const DB_FILE = path.join(DB_DIR, "campus_arena.sqlite");

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

export const sqliteDb = new Database(DB_FILE);

// Enable WAL mode for better concurrent read performance
sqliteDb.pragma("journal_mode = WAL");
sqliteDb.pragma("foreign_keys = ON");

// =============================================================================
// Schema — Create tables if they don't exist
// =============================================================================
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    college_id TEXT NOT NULL DEFAULT 'CAMPUS_MAIN',
    email TEXT UNIQUE NOT NULL,
    mobile TEXT NOT NULL,
    name TEXT NOT NULL,
    roll_number TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'student',
    avatar_url TEXT DEFAULT '',
    is_verified_college_user INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    roll_number TEXT,
    branch TEXT NOT NULL DEFAULT 'Computer Science & Engineering',
    year TEXT NOT NULL DEFAULT '1st Year',
    face_presence_verified INTEGER NOT NULL DEFAULT 0,
    technical_skills TEXT NOT NULL DEFAULT '[]',
    non_technical_skills TEXT NOT NULL DEFAULT '[]',
    domains TEXT NOT NULL DEFAULT '[]',
    github_url TEXT DEFAULT '',
    linkedin_url TEXT DEFAULT '',
    portfolio_url TEXT DEFAULT '',
    looking_for_team INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS otp_store (
    identifier TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS competitions (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    team_id TEXT,
    competition_id TEXT,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    round_id TEXT,
    team_id TEXT,
    competition_id TEXT,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS certificates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    competition_id TEXT,
    data TEXT NOT NULL,
    issued_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    competition_id TEXT,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_user_id TEXT,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// =============================================================================
// OTP helpers — used by authService
// =============================================================================
export const otpHelpers = {
  /** Store or replace an OTP for a given identifier */
  set(identifier: string, code: string, ttlMs = 10 * 60 * 1000) {
    const expiresAt = Date.now() + ttlMs;
    sqliteDb
      .prepare(
        `INSERT OR REPLACE INTO otp_store (identifier, code, expires_at, attempts)
         VALUES (?, ?, ?, 0)`
      )
      .run(identifier.toLowerCase().trim(), code, expiresAt);
  },

  /** Get a valid (non-expired) OTP entry */
  get(identifier: string): { code: string; attempts: number } | null {
    const row = sqliteDb
      .prepare(`SELECT code, expires_at, attempts FROM otp_store WHERE identifier = ?`)
      .get(identifier.toLowerCase().trim()) as
      | { code: string; expires_at: number; attempts: number }
      | undefined;

    if (!row) return null;
    if (row.expires_at < Date.now()) {
      this.delete(identifier);
      return null;
    }
    return { code: row.code, attempts: row.attempts };
  },

  /** Increment failed attempts */
  incrementAttempts(identifier: string) {
    sqliteDb
      .prepare(`UPDATE otp_store SET attempts = attempts + 1 WHERE identifier = ?`)
      .run(identifier.toLowerCase().trim());
  },

  /** Delete after successful verify or expiry */
  delete(identifier: string) {
    sqliteDb
      .prepare(`DELETE FROM otp_store WHERE identifier = ?`)
      .run(identifier.toLowerCase().trim());
  },

  /** Purge all expired OTPs */
  purgeExpired() {
    sqliteDb.prepare(`DELETE FROM otp_store WHERE expires_at < ?`).run(Date.now());
  },
};

// Purge expired OTPs every 5 minutes
setInterval(() => otpHelpers.purgeExpired(), 5 * 60 * 1000);

// =============================================================================
// User helpers
// =============================================================================
export const userHelpers = {
  findByEmail(email: string) {
    const row = sqliteDb
      .prepare(`SELECT * FROM users WHERE lower(email) = lower(?)`)
      .get(email.trim()) as Record<string, unknown> | undefined;
    return row ? mapUser(row) : null;
  },

  findByMobile(mobile: string) {
    const clean = mobile.replace(/\s+/g, "");
    const row = sqliteDb
      .prepare(`SELECT * FROM users WHERE replace(mobile, ' ', '') = ?`)
      .get(clean) as Record<string, unknown> | undefined;
    return row ? mapUser(row) : null;
  },

  findById(id: string) {
    const row = sqliteDb.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? mapUser(row) : null;
  },

  findByRollNumber(roll: string) {
    const row = sqliteDb
      .prepare(`SELECT * FROM users WHERE lower(roll_number) = lower(?)`)
      .get(roll.trim()) as Record<string, unknown> | undefined;
    return row ? mapUser(row) : null;
  },

  create(user: {
    id: string;
    email: string;
    mobile: string;
    name: string;
    rollNumber?: string;
    role?: string;
    avatarUrl?: string;
    collegeId?: string;
  }) {
    const now = new Date().toISOString();
    sqliteDb
      .prepare(
        `INSERT INTO users
           (id, college_id, email, mobile, name, roll_number, role, avatar_url, is_verified_college_user, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .run(
        user.id,
        user.collegeId ?? "CAMPUS_MAIN",
        user.email.toLowerCase().trim(),
        user.mobile.trim(),
        user.name.trim(),
        user.rollNumber?.toUpperCase() ?? null,
        user.role ?? "student",
        user.avatarUrl ?? "",
        now,
        now
      );
    return this.findById(user.id)!;
  },

  updateMobile(id: string, mobile: string) {
    sqliteDb
      .prepare(`UPDATE users SET mobile = ?, updated_at = ? WHERE id = ?`)
      .run(mobile.trim(), new Date().toISOString(), id);
  },

  updateRole(id: string, role: string) {
    sqliteDb
      .prepare(`UPDATE users SET role = ?, updated_at = ? WHERE id = ?`)
      .run(role, new Date().toISOString(), id);
    return this.findById(id);
  },

  all() {
    const rows = sqliteDb.prepare(`SELECT * FROM users ORDER BY created_at DESC`).all() as Record<
      string,
      unknown
    >[];
    return rows.map(mapUser);
  },
};

// =============================================================================
// Profile helpers
// =============================================================================
export const profileHelpers = {
  findByUserId(userId: string) {
    const row = sqliteDb.prepare(`SELECT * FROM profiles WHERE user_id = ?`).get(userId) as
      | Record<string, unknown>
      | undefined;
    return row ? mapProfile(row) : null;
  },

  create(profile: {
    id: string;
    userId: string;
    name: string;
    rollNumber?: string;
    branch?: string;
    year?: string;
  }) {
    const now = new Date().toISOString();
    sqliteDb
      .prepare(
        `INSERT INTO profiles
           (id, user_id, name, roll_number, branch, year, face_presence_verified,
            technical_skills, non_technical_skills, domains, github_url, linkedin_url,
            portfolio_url, looking_for_team, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, '[]', '[]', '[]', '', '', '', 0, ?)`
      )
      .run(
        profile.id,
        profile.userId,
        profile.name,
        profile.rollNumber ?? null,
        profile.branch ?? "Computer Science & Engineering",
        profile.year ?? "1st Year",
        now
      );
    return this.findByUserId(profile.userId)!;
  },

  update(
    userId: string,
    updates: Partial<{
      name: string;
      branch: string;
      year: string;
      technicalSkills: string[];
      nonTechnicalSkills: string[];
      domains: string[];
      githubUrl: string;
      linkedinUrl: string;
      portfolioUrl: string;
      lookingForTeam: boolean;
      facePresenceVerified: boolean;
    }>
  ) {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) { fields.push("name = ?"); values.push(updates.name); }
    if (updates.branch !== undefined) { fields.push("branch = ?"); values.push(updates.branch); }
    if (updates.year !== undefined) { fields.push("year = ?"); values.push(updates.year); }
    if (updates.technicalSkills !== undefined) { fields.push("technical_skills = ?"); values.push(JSON.stringify(updates.technicalSkills)); }
    if (updates.nonTechnicalSkills !== undefined) { fields.push("non_technical_skills = ?"); values.push(JSON.stringify(updates.nonTechnicalSkills)); }
    if (updates.domains !== undefined) { fields.push("domains = ?"); values.push(JSON.stringify(updates.domains)); }
    if (updates.githubUrl !== undefined) { fields.push("github_url = ?"); values.push(updates.githubUrl); }
    if (updates.linkedinUrl !== undefined) { fields.push("linkedin_url = ?"); values.push(updates.linkedinUrl); }
    if (updates.portfolioUrl !== undefined) { fields.push("portfolio_url = ?"); values.push(updates.portfolioUrl); }
    if (updates.lookingForTeam !== undefined) { fields.push("looking_for_team = ?"); values.push(updates.lookingForTeam ? 1 : 0); }
    if (updates.facePresenceVerified !== undefined) { fields.push("face_presence_verified = ?"); values.push(updates.facePresenceVerified ? 1 : 0); }

    if (!fields.length) return this.findByUserId(userId);
    fields.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(userId);

    sqliteDb.prepare(`UPDATE profiles SET ${fields.join(", ")} WHERE user_id = ?`).run(...values);
    return this.findByUserId(userId);
  },

  allLookingForTeam(excludeUserId?: string) {
    const rows = sqliteDb
      .prepare(
        `SELECT p.*, u.email, u.mobile FROM profiles p
         JOIN users u ON u.id = p.user_id
         WHERE p.looking_for_team = 1 AND p.user_id != ?`
      )
      .all(excludeUserId ?? "") as Record<string, unknown>[];
    return rows.map(mapProfile);
  },
};

// =============================================================================
// Mapping helpers — snake_case DB → camelCase TS
// =============================================================================
function mapUser(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    collegeId: row.college_id as string,
    email: row.email as string,
    mobile: row.mobile as string,
    name: row.name as string,
    rollNumber: (row.roll_number as string) ?? undefined,
    role: row.role as string,
    avatarUrl: (row.avatar_url as string) || "",
    isVerifiedCollegeUser: Boolean(row.is_verified_college_user),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapProfile(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    rollNumber: (row.roll_number as string) ?? undefined,
    branch: row.branch as string,
    year: row.year as string,
    facePresenceVerified: Boolean(row.face_presence_verified),
    technicalSkills: JSON.parse((row.technical_skills as string) || "[]") as string[],
    nonTechnicalSkills: JSON.parse((row.non_technical_skills as string) || "[]") as string[],
    domains: JSON.parse((row.domains as string) || "[]") as string[],
    githubUrl: (row.github_url as string) || "",
    linkedinUrl: (row.linkedin_url as string) || "",
    portfolioUrl: (row.portfolio_url as string) || "",
    lookingForTeam: Boolean(row.looking_for_team),
    updatedAt: row.updated_at as string,
  };
}

// =============================================================================
// Legacy JSON-DB shim — keeps all other services working without changes
// The JSON db interface is emulated on top of SQLite for competitions, teams, etc.
// =============================================================================
import { createInitialSeedData, type DatabaseSchema } from "./seed";

class DatabaseStore {
  private data: DatabaseSchema;

  constructor() {
    // Load non-user data from the JSON side (competitions, rounds, etc.)
    // Users come from SQLite; everything else still uses the JSON store for now.
    this.data = this.loadOrInit();
    // Sync users from SQLite into the in-memory data
    this.syncUsersFromSQLite();
  }

  private loadOrInit(): DatabaseSchema {
    const dbDir = path.resolve(process.cwd(), "server", "data");
    const dbFile = path.join(dbDir, "db.json");
    try {
      if (fs.existsSync(dbFile)) {
        const raw = fs.readFileSync(dbFile, "utf-8");
        const parsed = JSON.parse(raw) as DatabaseSchema;
        // Wipe seed users from the JSON side — SQLite is the source of truth
        parsed.users = [];
        parsed.profiles = [];
        return parsed;
      }
    } catch {}
    const initial = createInitialSeedData();
    initial.users = [];
    initial.profiles = [];
    this.persist(initial);
    return initial;
  }

  private syncUsersFromSQLite() {
    this.data.users = userHelpers.all() as DatabaseSchema["users"];
    this.data.profiles = sqliteDb
      .prepare("SELECT * FROM profiles")
      .all()
      .map((r) => mapProfile(r as Record<string, unknown>)) as DatabaseSchema["profiles"];
  }

  private persist(data: DatabaseSchema) {
    const dbDir = path.resolve(process.cwd(), "server", "data");
    const dbFile = path.join(dbDir, "db.json");
    try {
      if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
      const tmpFile = `${dbFile}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), "utf-8");
      fs.renameSync(tmpFile, dbFile);
    } catch (err) {
      console.error("[DB] Error saving to db.json:", err);
    }
  }

  public get(): DatabaseSchema {
    // Always return latest users from SQLite
    this.data.users = userHelpers.all() as DatabaseSchema["users"];
    this.data.profiles = sqliteDb
      .prepare("SELECT * FROM profiles")
      .all()
      .map((r) => mapProfile(r as Record<string, unknown>)) as DatabaseSchema["profiles"];
    return this.data;
  }

  public update(updater: (data: DatabaseSchema) => void): DatabaseSchema {
    updater(this.data);
    this.persist(this.data);
    return this.data;
  }

  public reset(): DatabaseSchema {
    this.data = createInitialSeedData();
    this.data.users = [];
    this.data.profiles = [];
    this.persist(this.data);
    return this.data;
  }
}

export const db = new DatabaseStore();
