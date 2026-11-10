import { test } from "node:test";
import assert from "node:assert/strict";
import type { Mandate } from "../src/lib/mandate";
import { canonical, intentWithinMandate, mandateProof, signGiftIntent, signMandate, verifySigned } from "../src/lib/mandate-sign";

// A signed mandate is only worth something if changing any term breaks the signature, and if a
// gift outside the signed limits can be spotted from the two signed payloads alone.

const gift = (over = {}) => ({ campaignId: "c1", donationId: "d1", patient: "Aarav S.", amount: "40.00", reason: "", authorizationId: "AUTH1", at: "2026-11-10T00:00:00.000Z", by: "agent" as const, ...over });
const m = (over: Partial<Mandate> = {}): Mandate => ({ id: "mdt_1", space: "s", donorName: "Grace", donorEmail: "Grace@Example.com", limitCents: 10000, perGiftCents: 4000, cause: "children who need surgery", status: "active", gifts: [], createdAt: "2026-11-10T00:00:00.000Z", ...over });

test("canonical JSON ignores key order", () => assert.equal(canonical({ b: 1, a: [2, { d: 1, c: 2 }] }), canonical({ a: [2, { c: 2, d: 1 }], b: 1 })));

test("a signed mandate verifies, and any changed term does not", () => {
  const s = signMandate(m());
  assert.equal(verifySigned(s.payload, s.signature), true);
  assert.equal(verifySigned({ ...s.payload, perGiftCents: 5000 }, s.signature), false);
  assert.equal(verifySigned({ ...s.payload, limitCents: 20000 }, s.signature), false);
  assert.equal(verifySigned(s.payload, s.signature.slice(0, -2) + "AA"), false);
});

test("the donor is named only by a hash, and signing is deterministic", () => {
  const s = signMandate(m());
  assert.ok(!JSON.stringify(s).toLowerCase().includes("grace@example.com"));
  assert.equal(s.signature, signMandate(m()).signature);
  assert.equal(s.digest, signMandate(m({ donorEmail: " grace@example.com " })).digest);
});

test("a gift intent is bound to the mandate it was placed under", () => {
  const before = m();
  const i = signGiftIntent(before, gift());
  assert.equal(verifySigned(i.payload, i.signature), true);
  assert.equal(i.payload.mandateDigest, signMandate(before).digest);
  assert.notEqual(i.payload.mandateDigest, signMandate(m({ perGiftCents: 9000 })).digest);
});

test("gifts outside the signed limits are spotted from the payloads alone", () => {
  const s = signMandate(m());
  const ok = signGiftIntent(m(), gift()).payload;
  assert.deepEqual(intentWithinMandate(s.payload, [ok], s.digest), { ok: true });
  assert.match(intentWithinMandate(s.payload, [{ ...ok, amountCents: 5000 }], s.digest).why!, /per-gift/);
  assert.match(intentWithinMandate(s.payload, [ok, { ...ok, donationId: "d2" }], s.digest).why!, /same family/);
  assert.match(intentWithinMandate(s.payload, [ok, { ...ok, campaignId: "c2" }, { ...ok, campaignId: "c3" }], s.digest).why!, /total limit/);
  assert.match(intentWithinMandate(s.payload, [{ ...ok, mandateDigest: "x" }], s.digest).why!, /different mandate/);
});

test("the proof bundle is self-consistent", () => {
  const p = mandateProof(m({ gifts: [gift(), gift({ campaignId: "c2", donationId: "d2", amount: "25.00" })] }));
  assert.equal(p.withinLimits.ok, true);
  assert.equal(p.gifts.length, 2);
  assert.ok(p.gifts.every((g) => verifySigned(g.payload, g.signature)));
  assert.equal(p.key.kid, p.mandate.kid);
});
