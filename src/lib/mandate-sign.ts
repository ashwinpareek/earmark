// Signed mandates. When a donor sets their Giving Agent's limits, Earmark signs those terms
// (Ed25519). Every gift the agent places carries a signed "intent" bound to the digest of the
// mandate it was placed under. Anyone holding Earmark's public key can then check, without
// trusting Earmark's database, that a gift was inside limits the donor had set: the same idea as
// the signed mandates in agent-payment protocols such as AP2, applied to PayPal holds.
// Nothing here talks to an AI model or to PayPal.
import { createHash, createPrivateKey, createPublicKey, sign, verify, type KeyObject } from "node:crypto";
import type { Mandate, MandateGift } from "./mandate";

const PKCS8_ED25519 = Buffer.from("302e020100300506032b657004220420", "hex");
let cached: { priv: KeyObject; pub: KeyObject; kid: string } | null = null;

/** One long-lived key per deployment, derived from a server secret so it survives restarts. */
function keys() {
  if (cached) return cached;
  const secret = process.env.MANDATE_SIGNING_SECRET || process.env.PAYPAL_CLIENT_SECRET || process.env.CRON_SECRET || "earmark-local-development-key";
  const seed = createHash("sha256").update(`earmark-mandate-v1:${secret}`).digest();
  const priv = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, seed]), format: "der", type: "pkcs8" });
  const pub = createPublicKey(priv);
  const kid = createHash("sha256").update(pub.export({ format: "der", type: "spki" })).digest("hex").slice(0, 16);
  return (cached = { priv, pub, kid });
}

/** Stable JSON: keys sorted, no whitespace. The bytes that get signed. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
}
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const b64 = (b: Buffer) => b.toString("base64url");

export const MANDATE_RULES = ["verified-campaigns-only", "no-failed-checks", "per-gift-limit", "total-limit", "one-gift-per-family", "holds-only-payee-is-hospital"] as const;

export type MandateTerms = { type: "earmark.mandate"; v: 1; mandateId: string; donor: string; cause: string; limitCents: number; perGiftCents: number; currency: "USD"; rules: readonly string[]; createdAt: string };
export type GiftIntent = { type: "earmark.gift-intent"; v: 1; mandateDigest: string; campaignId: string; donationId: string; amountCents: number; by: "donor" | "agent"; authorizationId?: string; at: string };
export type Signed<T> = { payload: T; digest: string; alg: "Ed25519"; kid: string; signature: string };

/** The terms a donor set. The donor is named only by a hash of their email. */
export function mandateTerms(m: Mandate): MandateTerms {
  return { type: "earmark.mandate", v: 1, mandateId: m.id, donor: sha(m.donorEmail.trim().toLowerCase()).slice(0, 24), cause: m.cause, limitCents: m.limitCents, perGiftCents: m.perGiftCents, currency: "USD", rules: MANDATE_RULES, createdAt: m.createdAt };
}

function signed<T>(payload: T): Signed<T> {
  const k = keys();
  const bytes = canonical(payload);
  return { payload, digest: sha(bytes), alg: "Ed25519", kid: k.kid, signature: b64(sign(null, Buffer.from(bytes), k.priv)) };
}

export const signMandate = (m: Mandate): Signed<MandateTerms> => signed(mandateTerms(m));

export function signGiftIntent(m: Mandate, g: MandateGift): Signed<GiftIntent> {
  return signed<GiftIntent>({ type: "earmark.gift-intent", v: 1, mandateDigest: signMandate(m).digest, campaignId: g.campaignId, donationId: g.donationId, amountCents: Math.round(Number(g.amount) * 100), by: g.by, authorizationId: g.authorizationId, at: g.at });
}

/** Does this signature belong to this payload, under Earmark's key? */
export function verifySigned(payload: unknown, signature: string): boolean {
  try { return verify(null, Buffer.from(canonical(payload)), keys().pub, Buffer.from(signature, "base64url")); } catch { return false; }
}

/** Is a signed gift inside the signed mandate it names? Pure arithmetic on the two payloads. */
export function intentWithinMandate(terms: MandateTerms, intents: GiftIntent[], digest: string): { ok: boolean; why?: string } {
  let total = 0;
  const seen = new Set<string>();
  for (const i of intents) {
    if (i.mandateDigest !== digest) return { ok: false, why: "A gift names a different mandate." };
    if (i.amountCents > terms.perGiftCents) return { ok: false, why: "A gift is over the per-gift limit." };
    if (seen.has(i.campaignId)) return { ok: false, why: "Two gifts went to the same family." };
    seen.add(i.campaignId);
    total += i.amountCents;
  }
  return total > terms.limitCents ? { ok: false, why: "The gifts add up to more than the total limit." } : { ok: true };
}

export function publicKey() {
  const k = keys();
  return { kid: k.kid, alg: "Ed25519", use: "sig", jwk: k.pub.export({ format: "jwk" }), canonicalization: "JSON with sorted keys and no whitespace (UTF-8)", signs: ["earmark.mandate", "earmark.gift-intent"] };
}

/** Everything a browser or another agent needs to check a mandate and its gifts. */
export function mandateProof(m: Mandate) {
  const mandate = signMandate(m);
  const gifts = m.gifts.map((g) => signGiftIntent(m, g));
  return { mandate, gifts, withinLimits: intentWithinMandate(mandate.payload, gifts.map((g) => g.payload), mandate.digest), key: publicKey() };
}
