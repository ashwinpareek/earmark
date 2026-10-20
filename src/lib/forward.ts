// PASS IT ON — what happens to the part of a pledge the bill didn't need.
//
// Earmark never holds that money. The donor chose, when pledging, what should happen to it:
//  • "release" (the default): it's never charged. Nothing else happens.
//  • "offer": it's still never charged, but the receipt offers another verified patient.
//    Accepting opens a NEW PayPal hold for that patient. The old hold is never reused: a hold
//    is approved for one payee and one purpose, and it was already closed by final_capture.
// The pure functions here are unit-tested; workflow.ts does the I/O.

import type { Campaign, SurplusOffer } from "./types";

export const MIN_OFFER_CENTS = 500; // below this, PayPal's fixed fees would eat a real share of the gift
export const OFFER_DAYS = 7;
export const GOAL_BUFFER = 1.1; // pledges close at the goal + 10% (a buffer for holds that lapse)

const cents = (v?: string | number) => Math.round(Number(v ?? 0) * 100);

export function offerOpen(o: SurplusOffer | undefined, now = new Date()): o is SurplusOffer {
  return !!o && o.status === "open" && Date.parse(o.expiresAt) > now.getTime();
}

/** Holds still pledged to a campaign. */
export const heldCents = (c: Campaign) => c.donations.filter((d) => d.status === "held").reduce((s, d) => s + cents(d.pledged), 0);

/** Open offers (from other campaigns' receipts) that point at campaign `id`. Counted against its
 *  need, so the same gap is never offered twice and offers never rebuild a surplus. */
export function offeredCents(id: string, all: Campaign[], now = new Date()) {
  let s = 0;
  for (const c of all) for (const d of c.donations) if (offerOpen(d.offer, now) && d.offer.campaignId === id) s += cents(d.offer.amount);
  return s;
}

/** How much a live campaign can still use: its verified goal, minus holds, minus open offers. */
export function needsCents(c: Campaign, all: Campaign[], now = new Date()) {
  return Math.max(0, cents(c.goal) - heldCents(c) - offeredCents(c.id, all, now));
}

/** Verified campaigns that could receive a passed-on gift, best first: the same hospital first,
 *  then the one closest to its goal. A fixed, public rule, so nobody can lobby for the offers. */
export function nextPatients(from: Campaign, all: Campaign[], now = new Date()) {
  return all
    .filter((c) => c.id !== from.id && c.status === "live" && !c.lab && (c.space ?? "main") === (from.space ?? "main"))
    .map((c) => ({ c, needs: needsCents(c, all, now) }))
    .filter((x) => x.needs >= MIN_OFFER_CENTS)
    .sort((a, b) => Number(b.c.providerId === from.providerId) - Number(a.c.providerId === from.providerId) || a.needs - b.needs || a.c.id.localeCompare(b.c.id));
}

/** Split donors' never-charged amounts across the targets' remaining needs. Bigger leftovers
 *  first; each donor gets at most one offer; no target is offered more than it needs. */
export function planOffers(donors: { id: string; neverChargedCents: number }[], targets: { id: string; needsCents: number }[], minCents = MIN_OFFER_CENTS) {
  const left = targets.map((t) => ({ ...t }));
  const out: { donorId: string; targetId: string; amountCents: number; needsCents: number }[] = [];
  for (const d of [...donors].sort((a, b) => b.neverChargedCents - a.neverChargedCents || a.id.localeCompare(b.id))) {
    if (d.neverChargedCents < minCents) continue;
    const t = left.find((x) => x.needsCents >= minCents);
    if (!t) break;
    const amount = Math.min(d.neverChargedCents, t.needsCents);
    out.push({ donorId: d.id, targetId: t.id, amountCents: amount, needsCents: t.needsCents });
    t.needsCents -= amount;
  }
  return out;
}
