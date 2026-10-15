import { test } from "node:test";
import assert from "node:assert/strict";
import { allocate } from "../src/lib/settlement";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

test("everyone pays the same fraction; totals are exact", () => {
  const r = allocate(229500, [
    { id: "a", pledgedCents: 100000 },
    { id: "b", pledgedCents: 150000 },
    { id: "c", pledgedCents: 10000 },
  ]);
  assert.equal(r.capturedCents, 229500);
  assert.equal(sum(r.allocations.map((a) => a.captureCents)), 229500);
  for (const a of r.allocations) assert.ok(a.captureCents >= 0 && a.neverChargedCents >= 0);
  // c pledged $100, total $2,600, payable $2,295 → ~$88.27
  assert.equal(r.allocations.find((a) => a.id === "c")!.captureCents, 8827);
});

test("bill larger than pledges: capture everything, report shortfall", () => {
  const r = allocate(500000, [{ id: "a", pledgedCents: 1000 }, { id: "b", pledgedCents: 2500 }]);
  assert.equal(r.capturedCents, 3500);
  assert.equal(r.shortfallCents, 496500);
  assert.ok(r.allocations.every((a) => a.neverChargedCents === 0));
});

test("nothing payable: everything voided", () => {
  const r = allocate(0, [{ id: "a", pledgedCents: 1234 }]);
  assert.deepEqual(r.allocations, [{ id: "a", captureCents: 0, neverChargedCents: 1234 }]);
});

test("rounding never over-charges anyone, leftover cents distributed", () => {
  const holds = Array.from({ length: 7 }, (_, i) => ({ id: `d${i}`, pledgedCents: 333 }));
  const r = allocate(1000, holds);
  assert.equal(r.capturedCents, 1000);
  for (const a of r.allocations) assert.ok(a.captureCents <= 333 && a.captureCents >= 142);
});

test("rejects bad input", () => {
  assert.throws(() => allocate(-1, []));
  assert.throws(() => allocate(1.5, []));
});

test("randomised: invariants hold", () => {
  for (let t = 0; t < 300; t++) {
    const holds = Array.from({ length: 1 + (t % 9) }, (_, i) => ({ id: `h${i}`, pledgedCents: 1 + ((t * 7919 + i * 104729) % 250000) }));
    const payable = (t * 15485863) % 600000;
    const r = allocate(payable, holds);
    const total = sum(holds.map((h) => h.pledgedCents));
    assert.equal(r.capturedCents, Math.min(payable, total));
    for (const a of r.allocations) {
      const h = holds.find((x) => x.id === a.id)!;
      assert.equal(a.captureCents + a.neverChargedCents, h.pledgedCents);
      assert.ok(a.captureCents >= 0 && a.captureCents <= h.pledgedCents);
    }
  }
});

import { planCaptures } from "../src/lib/settlement";

test("a lapsed hold's share is spread across the others, nobody exceeds their pledge", () => {
  const r = planCaptures(229500, [
    { id: "a", pledgedCents: 100000, usable: true },
    { id: "b", pledgedCents: 150000, usable: true },
    { id: "tom", pledgedCents: 10000, usable: false },
  ]);
  assert.deepEqual(r.lapsed, ["tom"]);
  assert.equal(r.capturedCents, 229500);
  assert.equal(r.shortfallCents, 0);
  assert.ok(!r.allocations.some((a) => a.id === "tom"));
});

test("if too many holds lapse, the gap is reported as a shortfall, not an error", () => {
  const r = planCaptures(229500, [
    { id: "a", pledgedCents: 100000, usable: true },
    { id: "b", pledgedCents: 150000, usable: false },
  ]);
  assert.equal(r.capturedCents, 100000);
  assert.equal(r.shortfallCents, 129500);
  assert.equal(r.allocations[0].neverChargedCents, 0);
});
