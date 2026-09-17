// =============================================================================
// Campus Arena — PostgreSQL persistent storage
// =============================================================================
// PostgreSQL is the single runtime source of truth. The service layer keeps its
// synchronous state API, while writes are committed in an ordered database
// queue and each API response waits for that queue before it is sent.

import { Pool } from "pg";
import path from "node:path";
import fs from "node:fs";
import { createInitialSeedData, type DatabaseSchema } from "./seed";
import type { StudentProfile, User } from "../../shared/types";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required. Configure a PostgreSQL connection string before starting Campus Arena."
  );
}

export const postgresPool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

type DomainCollection = Exclude<keyof DatabaseSchema, "users" | "profiles">;

const DOMAIN_COLLECTIONS = [
  "competitions",
  "tracks",
  "registrationFields",
  "teams",
  "teamMembers",
  "waitlist",
  "coupons",
  "waivers",
  "payments",
  "rounds",
  "submissions",
  "criteria",
  "judgeAssignments",
  "scores",
  "attendanceCheckpoints",
  "attendanceRecords",
  "certificates",
  "announcements",
  "notifications",
  "organizerMemberships",
  "disputes",
  "auditLogs",
  "reviews",
] as const satisfies readonly DomainCollection[];

type RawRecord = { id?: unknown; createdAt?: unknown; updatedAt?: unknown };

function emptyState(): DatabaseSchema {
  const state = { users: [], profiles: [] } as unknown as DatabaseSchema;
  for (const collection of DOMAIN_COLLECTIONS) {
    (state[collection] as unknown) = [];
  }
  return state;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function preferenceKey(userId: string) {
  return userId.trim();
}

function otpKey(identifier: string) {
  return identifier.toLowerCase().trim();
}

function readLegacySnapshot(): DatabaseSchema {
  const legacyFile = path.resolve(process.cwd(), "server", "data", "db.json");
  try {
    if (fs.existsSync(legacyFile)) {
      const parsed = JSON.parse(fs.readFileSync(legacyFile, "utf-8")) as Partial<DatabaseSchema>;
      const state = emptyState();
      state.users = Array.isArray(parsed.users) ? parsed.users : [];
      state.profiles = Array.isArray(parsed.profiles) ? parsed.profiles : [];
      for (const collection of DOMAIN_COLLECTIONS) {
        const records = parsed[collection];
        if (Array.isArray(records)) (state[collection] as unknown) = records;
      }
      return state;
    }
  } catch (error) {
    console.warn("[DB] The legacy JSON data could not be imported:", error);
  }

  // Preserve the current first-run experience once, then store it in PostgreSQL.
  return createInitialSeedData();
}

class DatabaseStore {
  private data = emptyState();
  private passwordHashes = new Map<string, string | null>();
  private preferences = new Map<string, Record<string, unknown>>();
  private otpEntries = new Map<string, { code: string; expiresAt: number; attempts: number }>();
  private writes: Promise<void> = Promise.resolve();

  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.initialize();
  }

  private async initialize() {
    await this.createSchema();
    const countResult = await postgresPool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM users");
    const recordCountResult = await postgresPool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM application_records"
    );

    if (Number(countResult.rows[0]?.count || 0) === 0 && Number(recordCountResult.rows[0]?.count || 0) === 0) {
      this.data = readLegacySnapshot();
      await this.persistState(this.data);
      console.log("[DB] Imported existing application data into PostgreSQL.");
    } else {
      await this.loadState();
    }

    await this.loadPreferences();
    await this.loadActiveOtps();
  }

  private async createSchema() {
    await postgresPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        mobile TEXT NOT NULL,
        password_hash TEXT,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

      CREATE TABLE IF NOT EXISTS profiles (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE IF NOT EXISTS application_records (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (collection, id)
      );

      CREATE INDEX IF NOT EXISTS idx_application_records_collection
        ON application_records (collection);
      CREATE INDEX IF NOT EXISTS idx_application_records_certificate_user
        ON application_records ((data->>'userId'))
        WHERE collection = 'certificates';
      CREATE INDEX IF NOT EXISTS idx_application_records_competition
        ON application_records ((data->>'competitionId'));

      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS otp_store (
        identifier TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        expires_at BIGINT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  private async loadState() {
    const state = emptyState();
    const [users, profiles, records] = await Promise.all([
      postgresPool.query<{ data: User; password_hash: string | null }>(
        "SELECT data, password_hash FROM users ORDER BY created_at ASC"
      ),
      postgresPool.query<{ data: StudentProfile }>("SELECT data FROM profiles ORDER BY updated_at ASC"),
      postgresPool.query<{ collection: string; data: unknown }>(
        "SELECT collection, data FROM application_records ORDER BY created_at ASC, id ASC"
      ),
    ]);

    state.users = users.rows.map((row) => row.data);
    state.profiles = profiles.rows.map((row) => row.data);
    this.passwordHashes.clear();
    for (const row of users.rows) this.passwordHashes.set(row.data.id, row.password_hash);

    for (const row of records.rows) {
      if (!DOMAIN_COLLECTIONS.includes(row.collection as DomainCollection)) continue;
      (state[row.collection as DomainCollection] as unknown as unknown[]).push(row.data);
    }
    this.data = state;
  }

  private async loadPreferences() {
    const result = await postgresPool.query<{ user_id: string; data: Record<string, unknown> }>(
      "SELECT user_id, data FROM user_preferences"
    );
    this.preferences.clear();
    for (const row of result.rows) this.preferences.set(row.user_id, row.data || {});
  }

  private async loadActiveOtps() {
    const now = Date.now();
    await postgresPool.query("DELETE FROM otp_store WHERE expires_at < $1", [now]);
    const result = await postgresPool.query<{ identifier: string; code: string; expires_at: string; attempts: number }>(
      "SELECT identifier, code, expires_at, attempts FROM otp_store"
    );
    this.otpEntries.clear();
    for (const row of result.rows) {
      this.otpEntries.set(row.identifier, {
        code: row.code,
        expiresAt: Number(row.expires_at),
        attempts: row.attempts,
      });
    }
  }

  private async persistState(snapshot: DatabaseSchema) {
    const client = await postgresPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM application_records");
      await client.query("DELETE FROM profiles");

      for (const user of snapshot.users) {
        await client.query(
          `INSERT INTO users (id, email, mobile, password_hash, data, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
             email = EXCLUDED.email,
             mobile = EXCLUDED.mobile,
             password_hash = EXCLUDED.password_hash,
             data = EXCLUDED.data,
             updated_at = EXCLUDED.updated_at`,
          [
            user.id,
            user.email.toLowerCase().trim(),
            user.mobile.trim(),
            this.passwordHashes.get(user.id) ?? null,
            JSON.stringify(user),
            user.createdAt || new Date().toISOString(),
            user.updatedAt || new Date().toISOString(),
          ]
        );
      }

      for (const profile of snapshot.profiles) {
        await client.query(
          "INSERT INTO profiles (user_id, data, updated_at) VALUES ($1, $2::jsonb, $3)",
          [profile.userId, JSON.stringify(profile), profile.updatedAt || new Date().toISOString()]
        );
      }

      for (const collection of DOMAIN_COLLECTIONS) {
        const records = snapshot[collection] as unknown as RawRecord[];
        for (const record of records) {
          if (typeof record.id !== "string" || !record.id) {
            throw new Error(`Cannot store ${collection}: each record requires a stable id.`);
          }
          const createdAt = typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString();
          const updatedAt = typeof record.updatedAt === "string" ? record.updatedAt : createdAt;
          await client.query(
            `INSERT INTO application_records (collection, id, data, created_at, updated_at)
             VALUES ($1, $2, $3::jsonb, $4, $5)`,
            [collection, record.id, JSON.stringify(record), createdAt, updatedAt]
          );
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private enqueue(write: () => Promise<void>) {
    this.writes = this.writes.catch(() => undefined).then(write);
    this.writes.catch((error) => console.error("[DB] PostgreSQL write failed:", error));
  }

  public async flush() {
    await this.ready;
    await this.writes;
  }

  public get(): DatabaseSchema {
    return this.data;
  }

  public update(updater: (data: DatabaseSchema) => void): DatabaseSchema {
    const draft = clone(this.data);
    updater(draft);
    this.data = draft;
    const snapshot = clone(draft);
    this.enqueue(() => this.persistState(snapshot));
    return this.data;
  }

  public replacePasswordHash(userId: string, passwordHash: string | null) {
    this.passwordHashes.set(userId, passwordHash);
    const snapshot = clone(this.data);
    this.enqueue(() => this.persistState(snapshot));
  }

  public getPasswordHash(userId: string) {
    return this.passwordHashes.get(userId) ?? null;
  }

  public getPreference(userId: string) {
    return clone(this.preferences.get(preferenceKey(userId)) ?? {});
  }

  public updatePreference(userId: string, updates: Record<string, unknown>) {
    const key = preferenceKey(userId);
    const next = { ...this.preferences.get(key), ...updates };
    this.preferences.set(key, next);
    const snapshot = clone(next);
    this.enqueue(async () => {
      await postgresPool.query(
        `INSERT INTO user_preferences (user_id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
        [key, JSON.stringify(snapshot)]
      );
    });
    return clone(next);
  }

  public setOtp(identifier: string, code: string, ttlMs: number) {
    const key = otpKey(identifier);
    const entry = { code, expiresAt: Date.now() + ttlMs, attempts: 0 };
    this.otpEntries.set(key, entry);
    this.enqueue(async () => {
      await postgresPool.query(
        `INSERT INTO otp_store (identifier, code, expires_at, attempts)
         VALUES ($1, $2, $3, 0)
         ON CONFLICT (identifier) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, attempts = 0`,
        [key, code, entry.expiresAt]
      );
    });
  }

  public getOtp(identifier: string) {
    const key = otpKey(identifier);
    const entry = this.otpEntries.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.deleteOtp(identifier);
      return null;
    }
    return { code: entry.code, attempts: entry.attempts };
  }

  public incrementOtpAttempts(identifier: string) {
    const key = otpKey(identifier);
    const entry = this.otpEntries.get(key);
    if (!entry) return;
    entry.attempts += 1;
    this.enqueue(async () => {
      await postgresPool.query("UPDATE otp_store SET attempts = $1 WHERE identifier = $2", [entry.attempts, key]);
    });
  }

  public deleteOtp(identifier: string) {
    const key = otpKey(identifier);
    this.otpEntries.delete(key);
    this.enqueue(async () => {
      await postgresPool.query("DELETE FROM otp_store WHERE identifier = $1", [key]);
    });
  }

  public purgeExpiredOtps() {
    const now = Date.now();
    for (const [key, entry] of Array.from(this.otpEntries.entries())) {
      if (entry.expiresAt < now) this.otpEntries.delete(key);
    }
    this.enqueue(async () => {
      await postgresPool.query("DELETE FROM otp_store WHERE expires_at < $1", [now]);
    });
  }

  public reset(): DatabaseSchema {
    this.data = createInitialSeedData();
    const snapshot = clone(this.data);
    this.enqueue(() => this.persistState(snapshot));
    return this.data;
  }
}

export const db = new DatabaseStore();
export const databaseReady = db.ready;

export const otpHelpers = {
  set(identifier: string, code: string, ttlMs = 10 * 60 * 1000) {
    db.setOtp(identifier, code, ttlMs);
  },
  get(identifier: string) {
    return db.getOtp(identifier);
  },
  incrementAttempts(identifier: string) {
    db.incrementOtpAttempts(identifier);
  },
  delete(identifier: string) {
    db.deleteOtp(identifier);
  },
  purgeExpired() {
    db.purgeExpiredOtps();
  },
};

export const userHelpers = {
  findByEmail(email: string) {
    const clean = email.trim().toLowerCase();
    return db.get().users.find((user) => user.email.toLowerCase() === clean) ?? null;
  },
  findByMobile(mobile: string) {
    const clean = mobile.replace(/\s+/g, "");
    return db.get().users.find((user) => user.mobile.replace(/\s+/g, "") === clean) ?? null;
  },
  findById(id: string) {
    return db.get().users.find((user) => user.id === id) ?? null;
  },
  findByRollNumber(roll: string) {
    const clean = roll.trim().toLowerCase();
    return db.get().users.find((user) => user.rollNumber?.toLowerCase() === clean) ?? null;
  },
  findForPasswordLogin(identifier: string) {
    const clean = identifier.trim().toLowerCase().replace(/\s+/g, "");
    const user = db
      .get()
      .users.find(
        (candidate) =>
          candidate.email.toLowerCase() === clean || candidate.mobile.replace(/\s+/g, "") === clean
      );
    return user ? { user, passwordHash: db.getPasswordHash(user.id) } : null;
  },
  setPassword(id: string, passwordHash: string) {
    db.replacePasswordHash(id, passwordHash);
    return this.findById(id);
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
    const created: User = {
      id: user.id,
      collegeId: user.collegeId ?? "CAMPUS_MAIN",
      email: user.email.toLowerCase().trim(),
      mobile: user.mobile.trim(),
      name: user.name.trim(),
      rollNumber: user.rollNumber?.toUpperCase(),
      role: (user.role ?? "student") as User["role"],
      avatarUrl: user.avatarUrl ?? "",
      isVerifiedCollegeUser: true,
      createdAt: now,
      updatedAt: now,
    };
    db.update((draft) => {
      if (draft.users.some((existing) => existing.email === created.email || existing.id === created.id)) {
        throw new Error("A user with this account already exists.");
      }
      draft.users.push(created);
    });
    return created;
  },
  updateMobile(id: string, mobile: string) {
    db.update((draft) => {
      const user = draft.users.find((candidate) => candidate.id === id);
      if (user) {
        user.mobile = mobile.trim();
        user.updatedAt = new Date().toISOString();
      }
    });
  },
  updateRole(id: string, role: string) {
    db.update((draft) => {
      const user = draft.users.find((candidate) => candidate.id === id);
      if (user) {
        user.role = role as User["role"];
        user.updatedAt = new Date().toISOString();
      }
    });
    return this.findById(id);
  },
  updateName(id: string, name: string) {
    db.update((draft) => {
      const user = draft.users.find((candidate) => candidate.id === id);
      if (user) {
        user.name = name.trim();
        user.updatedAt = new Date().toISOString();
      }
    });
    return this.findById(id);
  },
  all() {
    return db.get().users;
  },
};

export const profileHelpers = {
  findByUserId(userId: string) {
    return db.get().profiles.find((profile) => profile.userId === userId) ?? null;
  },
  create(profile: {
    id: string;
    userId: string;
    name: string;
    rollNumber?: string;
    branch?: string;
    year?: string;
  }) {
    const created: StudentProfile = {
      id: profile.id,
      userId: profile.userId,
      name: profile.name,
      rollNumber: profile.rollNumber ?? "",
      branch: profile.branch ?? "Computer Science & Engineering",
      year: profile.year ?? "1st Year",
      facePresenceVerified: false,
      technicalSkills: [],
      nonTechnicalSkills: [],
      domains: [],
      githubUrl: "",
      linkedinUrl: "",
      portfolioUrl: "",
      previousCompetitions: [],
      projects: [],
      achievements: [],
      certificates: [],
      lookingForTeam: false,
      updatedAt: new Date().toISOString(),
    };
    db.update((draft) => {
      if (!draft.profiles.some((existing) => existing.userId === created.userId)) draft.profiles.push(created);
    });
    return this.findByUserId(profile.userId)!;
  },
  update(userId: string, updates: Partial<{
    name: string;
    branch: string;
    year: string;
    technicalSkills: string[];
    nonTechnicalSkills: string[];
    domains: string[];
    githubUrl: string;
    linkedinUrl: string;
    portfolioUrl: string;
    profilePhotoUrl: string;
    previousCompetitions: string[];
    projects: Array<{ title: string; description: string; link?: string }>;
    achievements: string[];
    certificates: string[];
    lookingForTeam: boolean;
    facePresenceVerified: boolean;
  }>) {
    db.update((draft) => {
      const profile = draft.profiles.find((candidate) => candidate.userId === userId);
      if (profile) Object.assign(profile, updates, { updatedAt: new Date().toISOString() });
    });
    return this.findByUserId(userId);
  },
  allLookingForTeam(excludeUserId?: string) {
    return db.get().profiles.filter((profile) => profile.lookingForTeam && profile.userId !== excludeUserId);
  },
};

export const preferenceHelpers = {
  get(userId: string) {
    return db.getPreference(userId);
  },
  update(userId: string, updates: Record<string, unknown>) {
    return db.updatePreference(userId, updates);
  },
};

// Expired verification tokens are periodically removed from PostgreSQL.
setInterval(() => otpHelpers.purgeExpired(), 5 * 60 * 1000);
