// The donor's mandate for their Giving Agent. These are plain rules, enforced by code, not by the
// AI's prompt: the agent proposes gifts, this decides. Nothing here talks to an AI model.

export interface MandateGift { campaignId: string; donationId: string; patient: string; amount: string; reason: string; authorizationId?: string; at: string; by: "donor" | "agent" }

export interface Mandate {
  id: string;
  space: string;
  donorName: string;
  donorEmail: string;
  /** Most the agent may hold across all gifts, in cents. */
  limitCents: number;
  /** Most for any single gift, in cents. */
  perGiftCents: number;
  /** What the donor cares about, in their words. The agent uses it to choose; rules don't. */
  cause: string;
  status: "draft" | "active" | "revoked";
  /** PayPal Vault token for merchant-initiated holds. Server-side only: never sent to a browser. */
  vaultId?: string;
  payerEmail?: string;
  gifts: MandateGift[];
  createdAt: string;
  revokedAt?: string;
}

export const MIN_GIFT_CENTS = 500;

export type Candidate = { id: string; status: string; checksPassed: number; checksTotal: number; checksFailed: number; stillNeedsCents: number; patient: string };

export const spentCents = (m: Mandate) => m.gifts.reduce((s, g) => s + Math.round(Number(g.amount) * 100), 0);
export const remainingCents = (m: Mandate) => Math.max(0, m.limitCents - spentCents(m));

/** May the agent place this gift? Every rule is checked; the first failure is the answer. */
export function checkGift(m: Mandate, c: Candidate | undefined, cents: number, opts: { requireActive?: boolean } = {}): { ok: true } | { ok: false; why: string } {
  if (m.status === "revoked") return { ok: false, why: "The donor revoked this mandate." };
  if (opts.requireActive !== false && m.status !== "active") return { ok: false, why: "The donor hasn't approved the mandate with PayPal yet." };
  if (!c) return { ok: false, why: "That campaign isn't in the verified catalog." };
  if (c.status !== "live") return { ok: false, why: `${c.patient}'s campaign isn't accepting gifts.` };
  // A failed check holds a campaign for review; advisory warnings (say, no doctor's note) don't.
  if (c.checksTotal === 0 || c.checksFailed > 0) return { ok: false, why: `${c.patient}'s documents failed a check, so the agent may not give to it.` };
  if (!Number.isInteger(cents) || cents < MIN_GIFT_CENTS) return { ok: false, why: `Gifts start at $${(MIN_GIFT_CENTS / 100).toFixed(2)}.` };
  if (cents > m.perGiftCents) return { ok: false, why: `That's more than the donor's $${(m.perGiftCents / 100).toFixed(2)} limit per gift.` };
  if (cents > remainingCents(m)) return { ok: false, why: `Only $${(remainingCents(m) / 100).toFixed(2)} of the donor's $${(m.limitCents / 100).toFixed(2)} is left.` };
  if (cents > c.stillNeedsCents) return { ok: false, why: `${c.patient} only needs $${(c.stillNeedsCents / 100).toFixed(2)} more.` };
  if (m.gifts.some((g) => g.campaignId === c.id)) return { ok: false, why: `The donor has already given to ${c.patient}; the agent spreads gifts across families.` };
  return { ok: true };
}

/** What the browser may see. The vault token never leaves the server. */
export function publicMandate(m: Mandate) {
  const { vaultId, ...rest } = m;
  return { ...rest, hasPayPal: Boolean(vaultId), spent: (spentCents(m) / 100).toFixed(2), remaining: (remainingCents(m) / 100).toFixed(2) };
}
