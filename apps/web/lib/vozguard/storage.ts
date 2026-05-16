import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { CallTranscriptWebhookPayload, EmergencyOccurrence } from "./types";

type SnapshotShape = {
  updatedAt: string;
  latestCallId?: string;
  occurrences: EmergencyOccurrence[];
  events: CallTranscriptWebhookPayload[];
};

const DATA_DIR = path.join(process.cwd(), "apps", "web", ".data");
const DB_PATH = path.join(DATA_DIR, "vozguard.sqlite");
const SNAPSHOT_PATH = path.join(DATA_DIR, "vozguard-snapshot.json");

class VozGuardStorage {
  private db: DatabaseSync;

  constructor() {
    mkdirSync(DATA_DIR, { recursive: true });
    this.db = new DatabaseSync(DB_PATH);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS occurrences (
        call_id TEXT PRIMARY KEY,
        updated_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS webhook_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        call_id TEXT NOT NULL,
        received_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );
    `);
  }

  saveWebhookEvent(payload: CallTranscriptWebhookPayload) {
    const stmt = this.db.prepare(`INSERT INTO webhook_events (call_id, received_at, payload) VALUES (?, ?, ?)`);
    stmt.run(payload.callId, payload.timestamp, JSON.stringify(payload));
  }

  upsertOccurrence(occurrence: EmergencyOccurrence) {
    const existing = this.getOccurrence(occurrence.callId);

    const stmt = this.db.prepare(`
      INSERT INTO occurrences (call_id, updated_at, created_at, data)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(call_id) DO UPDATE SET
        updated_at=excluded.updated_at,
        data=excluded.data
    `);

    stmt.run(
      occurrence.callId,
      occurrence.updatedAt,
      existing?.receivedAt ?? occurrence.receivedAt,
      JSON.stringify(occurrence)
    );

    this.writeSnapshot(occurrence.callId);
  }

  getOccurrence(callId: string): EmergencyOccurrence | null {
    const stmt = this.db.prepare(`SELECT data FROM occurrences WHERE call_id = ?`);
    const row = stmt.get(callId) as { data: string } | undefined;
    if (!row) return null;

    return JSON.parse(row.data) as EmergencyOccurrence;
  }

  getLatestOccurrence(): EmergencyOccurrence | null {
    const stmt = this.db.prepare(`SELECT data FROM occurrences ORDER BY updated_at DESC LIMIT 1`);
    const row = stmt.get() as { data: string } | undefined;
    if (!row) return null;

    return JSON.parse(row.data) as EmergencyOccurrence;
  }

  listOccurrences(limit = 50): EmergencyOccurrence[] {
    const stmt = this.db.prepare(`SELECT data FROM occurrences ORDER BY updated_at DESC LIMIT ?`);
    const rows = stmt.all(limit) as Array<{ data: string }>;
    return rows.map((row) => JSON.parse(row.data) as EmergencyOccurrence);
  }

  listWebhookEvents(limit = 100): CallTranscriptWebhookPayload[] {
    const stmt = this.db.prepare(`SELECT payload FROM webhook_events ORDER BY id DESC LIMIT ?`);
    const rows = stmt.all(limit) as Array<{ payload: string }>;
    return rows.map((row) => JSON.parse(row.payload) as CallTranscriptWebhookPayload);
  }

  patchOccurrence(
    callId: string,
    patch: {
      checklist?: EmergencyOccurrence["immediateRiskChecklist"];
      status?: EmergencyOccurrence["status"];
      suggestedActionStatus?: string;
      timelineLabel?: string;
      timelineSeverity?: EmergencyOccurrence["timeline"][number]["severity"];
    }
  ) {
    const current = this.getOccurrence(callId);
    if (!current) return null;

    const next: EmergencyOccurrence = {
      ...current,
      immediateRiskChecklist: patch.checklist
        ? {
            ...current.immediateRiskChecklist,
            ...patch.checklist
          }
        : current.immediateRiskChecklist,
      status: patch.status ?? current.status,
      suggestedAction: patch.suggestedActionStatus
        ? {
            ...current.suggestedAction,
            status: patch.suggestedActionStatus
          }
        : current.suggestedAction,
      updatedAt: new Date().toISOString(),
      timeline: [
        ...current.timeline,
        {
          time: new Date().toISOString(),
          label: patch.timelineLabel ?? "Ocorrência atualizada manualmente pelo operador.",
          severity: patch.timelineSeverity ?? "info"
        }
      ].slice(-40)
    };

    this.upsertOccurrence(next);
    return next;
  }

  private writeSnapshot(latestCallId?: string) {
    const snapshot: SnapshotShape = {
      updatedAt: new Date().toISOString(),
      latestCallId,
      occurrences: this.listOccurrences(200),
      events: this.listWebhookEvents(200)
    };

    writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), "utf-8");
  }

  readSnapshot(): SnapshotShape | null {
    if (!existsSync(SNAPSHOT_PATH)) return null;

    try {
      const raw = readFileSync(SNAPSHOT_PATH, "utf-8");
      return JSON.parse(raw) as SnapshotShape;
    } catch {
      return null;
    }
  }
}

const globalStorage = globalThis as unknown as { vozguardStorage?: VozGuardStorage };

export function getVozGuardStorage() {
  if (!globalStorage.vozguardStorage) {
    globalStorage.vozguardStorage = new VozGuardStorage();
  }

  return globalStorage.vozguardStorage;
}
