import { promises as fs } from "node:fs";
import path from "node:path";
import type { Campaign, TimelineEvent } from "./types";
import { uid, nowIso } from "./util";

// Tiny JSON-file store: zero setup for judges. Writes are serialized through a promise
// queue and written atomically (tmp file + rename), so a crash never corrupts the file.

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

/** Every document fingerprint ever seen, across all campaigns — powers duplicate detection. */
export interface FingerprintEntry {
  campaignId: string;
  docId: string;
  sha256: string;
  fingerprint: string;
  patientKey: string;
  at: string;
}

interface DB {
  campaigns: Record<string, Campaign>;
  fingerprints: FingerprintEntry[];
  webhookEvents: { id: string; type: string; at: string; verified: boolean }[];
}

type G = typeof globalThis & { __earmarkDb?: DB; __earmarkQueue?: Promise<unknown> };
const g = globalThis as G;

async function load(): Promise<DB> {
  if (g.__earmarkDb) return g.__earmarkDb;
  try {
    g.__earmarkDb = JSON.parse(await fs.readFile(DB_FILE, "utf8")) as DB;
  } catch {
    g.__earmarkDb = { campaigns: {}, fingerprints: [], webhookEvents: [] };
  }
  g.__earmarkDb.fingerprints ??= [];
  g.__earmarkDb.webhookEvents ??= [];
  return g.__earmarkDb;
}

async function persist(db: DB) {
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

export async function listCampaigns(): Promise<Campaign[]> {
  const db = await load();
  return Object.values(db.campaigns)
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
    return fn(c);
  });
}

export async function fingerprints(): Promise<FingerprintEntry[]> {
  return (await load()).fingerprints.slice();
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
