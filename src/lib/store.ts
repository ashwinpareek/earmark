import { promises as fs } from "node:fs";
import path from "node:path";
import type { Campaign, TimelineEvent } from "./types";
import { uid, nowIso } from "./util";
import { loadState, saveState, usingPostgres } from "./pg";

// Tiny document store: a JSON file locally (zero setup for judges), or one Postgres row when
// DATABASE_URL is set (see pg.ts), so a hosted demo survives restarts. Writes are serialized through a promise
// queue and written atomically (tmp file + rename), so a crash never corrupts the file.

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

/** Every document fingerprint ever seen, across all campaigns — powers duplicate detection. */
export interface FingerprintEntry {
  campaignId: string;
  docId: string;
  sha256: string;
  fingerprint: string;
  phash?: string;
  patientKey: string;
  campaignLabel: string;
  docKind: string;
  docNumber: string;
  issuer: string;
  space?: string;
  at: string;
}

export interface LabAttempt {
  at: string;
  campaignId: string;
  edits: string[];
  requested: string; // the amount the forgery asked donors for
  outcome: "held" | "live";
  caughtBy: string[]; // labels of the checks that failed
}
export interface LabStats { attempts: number; held: number; requestedCents: number; recent: LabAttempt[] }

interface DB {
  lab?: LabStats;
  campaigns: Record<string, Campaign>;
  fingerprints: FingerprintEntry[];
  webhookEvents: { id: string; type: string; at: string; verified: boolean }[];
}

type G = typeof globalThis & { __earmarkDb?: DB; __earmarkQueue?: Promise<unknown> };
const g = globalThis as G;

async function load(): Promise<DB> {
  if (g.__earmarkDb) return g.__earmarkDb;
  if (usingPostgres()) {
    g.__earmarkDb = (await loadState<DB>()) ?? { campaigns: {}, fingerprints: [], webhookEvents: [] };
  } else {
    try {
      g.__earmarkDb = JSON.parse(await fs.readFile(DB_FILE, "utf8")) as DB;
    } catch {
      g.__earmarkDb = { campaigns: {}, fingerprints: [], webhookEvents: [] };
    }
  }
  g.__earmarkDb.fingerprints ??= [];
  for (const c of Object.values(g.__earmarkDb.campaigns)) c.careCosts ??= [];
  g.__earmarkDb.webhookEvents ??= [];
  return g.__earmarkDb;
}

async function persist(db: DB) {
  if (usingPostgres()) return saveState(db);
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + "." + process.pid + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(db, null, 2));
  await fs.rename(tmp, DB_FILE);
}

export function tx<T>(fn: (db: DB) => Promise<T> | T): Promise<T> {
  const prev = g.__earmarkQueue ?? Promise.resolve();
  const next = prev.then(async () => {
    const db = await load();
    const result = await fn(db);
    await persist(db);
    return result;
  });
  g.__earmarkQueue = next.catch(() => undefined);
  return next;
}

export async function getCampaign(id: string): Promise<Campaign | undefined> {
  const db = await load();
  const c = db.campaigns[id];
  return c ? structuredClone(c) : undefined;
}

export const spaceOf = (x: { space?: string }) => x.space ?? "main";

export async function listCampaigns(spaces?: string[]): Promise<Campaign[]> {
  const db = await load();
  return Object.values(db.campaigns)
    .filter((c) => !spaces || spaces.includes(spaceOf(c)))
    .map((c) => structuredClone(c))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveCampaign(c: Campaign) {
  await tx((db) => {
    db.campaigns[c.id] = c;
  });
}

export async function updateCampaign<T>(id: string, fn: (c: Campaign) => Promise<T> | T): Promise<T> {
  return tx(async (db) => {
    const c = db.campaigns[id];
    if (!c) throw new HttpError(404, "Campaign not found");
    const r = await fn(c);
    // In mock mode there is no PayPal to confirm anything; label it honestly as mock.
    if (process.env.PAYPAL_MODE === "mock" || !process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      for (const m of c.movements) m.confirmed ??= { at: new Date().toISOString(), via: "mock" };
    }
    return r;
  });
}

/** Find the campaign holding a movement that matches, across all campaigns (webhooks don't
 *  always carry our custom_id, e.g. payout items). */
export async function confirmMovements(match: (m: Campaign["movements"][number]) => boolean, via: "webhook" | "api", status?: string) {
  return tx((db) => {
    let n = 0;
    for (const c of Object.values(db.campaigns)) {
      for (const m of c.movements) {
        if (!match(m)) continue;
        m.confirmed = { at: new Date().toISOString(), via, status };
        if (status) m.status = status;
        n++;
      }
    }
    return n;
  });
}

export async function fingerprints(space?: string): Promise<FingerprintEntry[]> {
  return (await load()).fingerprints.filter((f) => !space || spaceOf(f) === space);
}

/** Wipe a demo space: its campaigns and fingerprints. Never touches "main". */
export async function deleteSpace(space: string) {
  if (!space.startsWith("demo_")) throw new HttpError(400, "Only demo spaces can be reset");
  return tx((db) => {
    let n = 0;
    for (const [id, c] of Object.entries(db.campaigns)) if (spaceOf(c) === space) { delete db.campaigns[id]; n++; }
    db.fingerprints = db.fingerprints.filter((f) => spaceOf(f) !== space);
    return n;
  });
}

export async function addFingerprints(entries: Omit<FingerprintEntry, "at">[]) {
  await tx((db) => {
    for (const e of entries) {
      if (!db.fingerprints.some((f) => f.docId === e.docId)) db.fingerprints.push({ ...e, at: nowIso() });
    }
  });
}

export async function recordWebhook(e: { id: string; type: string; verified: boolean }) {
  await tx((db) => {
    db.webhookEvents.unshift({ ...e, at: nowIso() });
    db.webhookEvents = db.webhookEvents.slice(0, 200);
  });
}

export async function listWebhooks() {
  return (await load()).webhookEvents.slice();
}

export function addEvent(c: Campaign, e: Omit<TimelineEvent, "id" | "at">) {
  c.events.push({ id: uid("evt"), at: nowIso(), ...e });
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Forgery Lab: global, public counters (shared by every visitor). */
export async function recordLabAttempt(a: LabAttempt) {
  return tx((db) => {
    const l = (db.lab ??= { attempts: 0, held: 0, requestedCents: 0, recent: [] });
    l.attempts++;
    if (a.outcome === "held") l.held++;
    l.requestedCents += Math.round(Number(a.requested) * 100) || 0;
    l.recent = [a, ...l.recent].slice(0, 25);
    return structuredClone(l);
  });
}

export async function labStats(): Promise<LabStats> {
  const db = await load();
  return structuredClone(db.lab ?? { attempts: 0, held: 0, requestedCents: 0, recent: [] });
}
