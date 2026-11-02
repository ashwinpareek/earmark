import { test } from "node:test";
import assert from "node:assert/strict";
import { checkGift, publicMandate, remainingCents, type Mandate, type Candidate } from "../src/lib/mandate";

// The Giving Agent's limits are code, not prompt. These are the rules a hijacked or confused agent
// would run into before PayPal is ever called.

const m = (over: Partial<Mandate> = {}): Mandate => ({ id: "m1", space: "s", donorName: "Grace", donorEmail: "g@example.com", limitCents: 10000, perGiftCents: 4000, cause: "kids", status: "active", vaultId: "TOKEN", gifts: [], createdAt: "", ...over });
const c = (over: Partial<Candidate> = {}): Candidate => ({ id: "c1", status: "live", checksPassed: 9, checksTotal: 10, checksFailed: 0, stillNeedsCents: 300000, patient: "Sam O.", ...over });

test("a gift within every limit is allowed", () => assert.deepEqual(checkGift(m(), c(), 2500), { ok: true }));

test("each rule refuses on its own", () => {
  const no = (r: ReturnType<typeof checkGift>) => { assert.equal(r.ok, false); return (r as { why: string }).why; };
  assert.match(no(checkGift(m({ status: "revoked" }), c(), 2500)), /revoked/);
  assert.match(no(checkGift(m({ status: "draft" }), c(), 2500)), /approved/);
  assert.match(no(checkGift(m(), undefined, 2500)), /catalog/);
  assert.match(no(checkGift(m(), c({ status: "needs_review" }), 2500)), /isn't accepting/);
  assert.match(no(checkGift(m(), c({ checksFailed: 1 }), 2500)), /failed a check/);
  assert.match(no(checkGift(m(), c(), 400)), /start at/);
  assert.match(no(checkGift(m(), c(), 4001)), /per gift/);
  assert.match(no(checkGift(m({ gifts: [{ campaignId: "c9", donationId: "d", patient: "X", amount: "80.00", reason: "", at: "", by: "agent" }] }), c(), 3000)), /left/);
  assert.match(no(checkGift(m(), c({ stillNeedsCents: 1000 }), 2500)), /only needs/);
  assert.match(no(checkGift(m({ gifts: [{ campaignId: "c1", donationId: "d", patient: "Sam O.", amount: "10.00", reason: "", at: "", by: "agent" }] }), c(), 1000)), /already given/);
});

test("a draft mandate may propose (for the donor's first PayPal approval) but not act", () => {
  assert.deepEqual(checkGift(m({ status: "draft", vaultId: undefined }), c(), 2500, { requireActive: false }), { ok: true });
  assert.equal(checkGift(m({ status: "draft", vaultId: undefined }), c(), 2500).ok, false);
});

test("the PayPal token never leaves the server", () => {
  const p = publicMandate(m());
  assert.equal("vaultId" in p, false);
  assert.equal(p.hasPayPal, true);
  assert.equal(remainingCents(m({ gifts: [{ campaignId: "c", donationId: "d", patient: "", amount: "25.00", reason: "", at: "", by: "agent" }] })), 7500);
});
