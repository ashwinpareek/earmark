import { customAlphabet } from "nanoid";

const nano = customAlphabet("0123456789abcdefghijkmnopqrstuvwxyz", 10);

export const uid = (prefix: string) => `${prefix}_${nano()}`;
export const nowIso = () => new Date().toISOString();

/** Money is handled in integer cents to avoid floating point errors. */
export const toCents = (amount: string | number): number => {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) throw new Error(`Invalid amount: ${amount}`);
  return Math.round(n * 100);
};

export const fromCents = (cents: number): string => (cents / 100).toFixed(2);

export const fmtMoney = (amount: string | number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(amount));

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const appBaseUrl = () =>
  process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";

export const autoReleaseMinutes = () => {
  const n = Number(process.env.AUTO_RELEASE_MINUTES ?? 2);
  return Number.isFinite(n) && n >= 0 ? n : 2;
};
