// SETTLEMENT MATH — pure functions, integer cents, unit-tested.
//
// Given the verified payable amount and every donor's held pledge, decide how much to
// capture from each hold. Rule: every donor pays the SAME FRACTION of their pledge, so a
// $10 donor and a $500 donor are treated identically. Shares are floored to the cent and
// the few leftover cents go to the holds with the largest fractional remainders
// (largest-remainder method), never exceeding any pledge. Whatever isn't captured is
// voided by PayPal (final_capture) and never charged.

export interface Hold {
  id: string;
  pledgedCents: number;
}

export interface Allocation {
  id: string;
  captureCents: number;
  neverChargedCents: number;
}

export function allocate(payableCents: number, holds: Hold[]): { allocations: Allocation[]; capturedCents: number; shortfallCents: number } {
  if (!Number.isInteger(payableCents) || payableCents < 0) throw new Error("payableCents must be a non-negative integer");
  const total = holds.reduce((s, h) => s + h.pledgedCents, 0);
  const target = Math.min(payableCents, total);
  if (total === 0 || target === 0) {
    return {
      allocations: holds.map((h) => ({ id: h.id, captureCents: 0, neverChargedCents: h.pledgedCents })),
      capturedCents: 0,
      shortfallCents: payableCents,
    };
  }
  // exact share = pledged * target / total, done in integers to avoid float drift
  const exact = holds.map((h) => {
    const num = h.pledgedCents * target;
    return { h, floor: Math.floor(num / total), rem: num % total };
  });
  let leftover = target - exact.reduce((s, x) => s + x.floor, 0);
  const order = [...exact].sort((a, b) => b.rem - a.rem || b.h.pledgedCents - a.h.pledgedCents || a.h.id.localeCompare(b.h.id));
  for (const x of order) {
    if (leftover <= 0) break;
    if (x.floor < x.h.pledgedCents) {
      x.floor += 1;
      leftover -= 1;
    }
  }
  const allocations = exact.map((x) => ({ id: x.h.id, captureCents: x.floor, neverChargedCents: x.h.pledgedCents - x.floor }));
  const capturedCents = allocations.reduce((s, a) => s + a.captureCents, 0);
  return { allocations, capturedCents, shortfallCents: payableCents - capturedCents };
}
