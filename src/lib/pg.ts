import type { Pool } from "pg";

// Optional Postgres persistence. With DATABASE_URL set (Render Postgres in render.yaml), the
// whole app state and every uploaded document live in Postgres, so restarts, redeploys and
// free-plan sleeps lose nothing. Without it, the JSON file store is used (zero setup locally).

type G = typeof globalThis & { __earmarkPg?: Promise<Pool | null> };
const g = globalThis as G;

export const usingPostgres = () => Boolean(process.env.DATABASE_URL);

export function pool(): Promise<Pool | null> {
  if (!usingPostgres()) return Promise.resolve(null);
  g.__earmarkPg ??= (async () => {
    const { Pool } = await import("pg");
    const url = process.env.DATABASE_URL!;
    const local = /localhost|127\.0\.0\.1/.test(url);
    const p = new Pool({ connectionString: url, max: 4, ssl: local || process.env.PGSSL === "off" ? undefined : { rejectUnauthorized: false } });
    await p.query(`create table if not exists earmark_state (key text primary key, value jsonb not null, updated_at timestamptz not null default now())`);
    await p.query(`create table if not exists earmark_files (hash text primary key, mime text not null, data bytea not null, created_at timestamptz not null default now())`);
    return p;
  })();
  return g.__earmarkPg;
}

export async function loadState<T>(): Promise<T | null> {
  const p = await pool();
  if (!p) return null;
  const r = await p.query("select value from earmark_state where key = 'db'");
  return (r.rows[0]?.value as T) ?? null;
}

export async function saveState(value: unknown) {
  const p = await pool();
  if (!p) return;
  await p.query(
    "insert into earmark_state (key, value, updated_at) values ('db', $1, now()) on conflict (key) do update set value = excluded.value, updated_at = now()",
    [JSON.stringify(value)],
  );
}

export async function putFile(hash: string, mime: string, data: Buffer) {
  const p = await pool();
  if (!p) return;
  await p.query("insert into earmark_files (hash, mime, data) values ($1, $2, $3) on conflict (hash) do nothing", [hash, mime, data]);
}

export async function getFile(hash: string): Promise<Buffer | null> {
  const p = await pool();
  if (!p) return null;
  const r = await p.query("select data from earmark_files where hash = $1", [hash]);
  return (r.rows[0]?.data as Buffer) ?? null;
}
