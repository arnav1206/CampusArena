// =============================================================================
// Campus Arena — Persistent Repository Store
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import { createInitialSeedData, type DatabaseSchema } from "./seed";

const DB_DIR = path.resolve(process.cwd(), "server", "data");
const DB_FILE = path.join(DB_DIR, "db.json");

class DatabaseStore {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadOrInit();
  }

  private loadOrInit(): DatabaseSchema {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return parsed;
      }
    } catch (err) {
      console.warn("[DB] Failed reading db.json, initializing fresh seed:", err);
    }

    const initial = createInitialSeedData();
    this.persist(initial);
    return initial;
  }

  private persist(data: DatabaseSchema) {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      const tmpFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), "utf-8");
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error("[DB] Error saving to db.json:", err);
    }
  }

  public get(): DatabaseSchema {
    return this.data;
  }

  public update(updater: (data: DatabaseSchema) => void): DatabaseSchema {
    updater(this.data);
    this.persist(this.data);
    return this.data;
  }

  public reset(): DatabaseSchema {
    this.data = createInitialSeedData();
    this.persist(this.data);
    return this.data;
  }
}

export const db = new DatabaseStore();
