import { test } from "node:test";
import assert from "node:assert/strict";
import samples from "../src/lib/sample-extractions.json";
import { verifyCampaign, fingerprintOf, patientKey, arithmeticCheck, ageFromDob } from "../src/lib/forensics";
import { reviewBill, matchLines, similarity } from "../src/lib/reconcile";
import { reviewReceipt, careRoom } from "../src/lib/care";
import { providers } from "../src/lib/providers";
import type { Campaign, Doc, DocKind, Extraction } from "../src/lib/types";

delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.GEMINI_API_KEY;

const ON = new Date("2026-10-21T12:00:00Z");
const S = samples as Record<string, { file: string; extraction: Extraction }>;
const byFile = (f: string) => {
  const [sha, v] = Object.entries(S).find(([, x]) => x.file === f)!;
  return { sha, e: v.extraction };
};
const doc = (id: string, kind: DocKind, file: string): Doc => {
  const { sha, e } = byFile(file);
  return { id, kind, filename: file, mime: "image/png", sha256: sha, size: 1, uploadedAt: "", uploadedBy: "organizer", extraction: structuredClone(e) };
};
const riverside = providers()[0];

const mayaDocs = [doc("m1", "estimate", "maya-estimate.png"), doc("m2", "identity", "maya-registration.png"), doc("m3", "medical_note", "maya-clinical-note.png")];

test("honest campaign is verified with the estimate as goal", () => {
  const r = verifyCampaign({ campaignId: "maya", docs: mayaDocs, provider: riverside, prior: [], on: ON });
  assert.equal(r.decision, "verified", JSON.stringify(r.checks.filter((c) => c.status !== "pass"), null, 2));
  assert.equal(r.verifiedGoal, 2400);
});

test("doctored campaign is HELD (never auto-rejected), high risk, for the right reasons", () => {
  const prior = mayaDocs.map((d) => ({ campaignId: "maya", docId: d.id, sha256: d.sha256, fingerprint: fingerprintOf(d.extraction!), patientKey: patientKey(d.extraction!.patientName), campaignLabel: "Help Maya (Maya R.)" }));
  const leo = [doc("l1", "estimate", "leo-estimate.png"), doc("l2", "identity", "leo-registration.png")];
  const r = verifyCampaign({ campaignId: "leo", docs: leo, provider: riverside, prior, on: ON });
  assert.equal(r.decision, "needs_review");
  assert.equal(r.risk, "high");
  assert.equal(r.verifiedGoal, 3150); // only what the itemised lines support, not the inflated total
  assert.deepEqual(r.checks.find((c) => c.id === "duplicate")!.refs, [{ campaignId: "maya", label: "Help Maya (Maya R.)" }]);
  const failed = new Set(r.checks.filter((c) => c.status === "fail").map((c) => c.id));
  for (const id of ["arithmetic", "identity", "duplicate", "injection", "provider_contact"]) assert.ok(failed.has(id), `expected ${id} to fail`);
  assert.match(r.checks.find((c) => c.id === "arithmetic")!.detail, /\$3,150\.00.*\$9,850\.00/);
});

test("the same documents in the same campaign are not flagged as duplicates", () => {
  const prior = mayaDocs.map((d) => ({ campaignId: "maya", docId: d.id, sha256: d.sha256, fingerprint: fingerprintOf(d.extraction!), patientKey: patientKey(d.extraction!.patientName), campaignLabel: "Help Maya (Maya R.)" }));
  const r = verifyCampaign({ campaignId: "maya", docs: mayaDocs, provider: riverside, prior, on: ON });
  assert.equal(r.checks.find((c) => c.id === "duplicate")!.status, "pass");
});

test("arithmetic accepts gross-minus-insurer layouts", () => {
  const e = { ...byFile("maya-estimate.png").e, lineItems: [{ description: "Gross", quantity: 1, amount: 11850 }], insuranceCovered: 9450, total: 2400 };
  assert.equal(arithmeticCheck(e, "x").status, "pass");
});

test("age from date of birth", () => {
  assert.equal(ageFromDob("2017-03-04", ON), 9);
  assert.equal(ageFromDob("1991-05-14", ON), 35);
  assert.equal(ageFromDob("nope", ON), null);
});

test("line matching pairs bill lines with estimate lines", () => {
  const est = byFile("maya-estimate.png").e.lineItems;
  const bill = byFile("maya-final-bill.png").e.lineItems;
  const m = matchLines(bill, est);
  assert.equal(m[0], 0); // surgeon
  assert.equal(m[3], 3); // room per night
  assert.equal(m[6], null); // parking isn't on the estimate
  assert.ok(similarity("Operating room, 70 minutes", "Operating room, up to 90 minutes") > 0.4);
});

test("final bill: parking excluded, payable under the estimate, approved", async () => {
  const c: Campaign = {
    id: "maya", createdAt: "", status: "live", currency: "USD", organizer: { name: "", email: "", relationship: "" }, providerId: riverside.id,
    patient: { displayName: "Maya R.", age: 9 }, title: "", story: "", facts: [], goal: "2400.00", docs: mayaDocs, donations: [], careCosts: [], movements: [], events: [],
  };
  const bill = doc("b1", "final_bill", "maya-final-bill.png");
  const r = await reviewBill({ campaign: c, bill, provider: riverside, prior: [], on: ON });
  assert.equal(r.decision, "approve", JSON.stringify(r.checks.filter((k) => k.status !== "pass"), null, 2));
  assert.equal(r.billTotal, 2340);
  assert.equal(r.payable, 2295);
  assert.equal(r.lines.find((l) => /parking/i.test(l.description))!.covered, false);
});

test("final bill for a different patient is rejected", async () => {
  const c: Campaign = {
    id: "maya", createdAt: "", status: "live", currency: "USD", organizer: { name: "", email: "", relationship: "" }, providerId: riverside.id,
    patient: { displayName: "Maya R.", age: 9 }, title: "", story: "", facts: [], goal: "2400.00", docs: mayaDocs, donations: [], careCosts: [], movements: [], events: [],
  };
  const bill = doc("b2", "final_bill", "maya-final-bill.png");
  bill.extraction!.patientName = "Somebody Else";
  const r = await reviewBill({ campaign: c, bill, provider: riverside, prior: [], on: ON });
  assert.equal(r.decision, "reject");
  assert.equal(r.payable, 0);
});

test("copycat: the same files in another campaign are caught, and the original is named", () => {
  const prior = mayaDocs.map((d) => ({ campaignId: "maya", docId: d.id, sha256: d.sha256, fingerprint: fingerprintOf(d.extraction!), patientKey: patientKey(d.extraction!.patientName), campaignLabel: "Help Maya (Maya R.)" }));
  const copy = [doc("c1", "estimate", "maya-estimate.png"), doc("c2", "identity", "maya-registration.png")];
  const r = verifyCampaign({ campaignId: "copycat", docs: copy, provider: riverside, prior, on: ON });
  assert.equal(r.decision, "needs_review");
  const dup = r.checks.find((c) => c.id === "duplicate")!;
  assert.equal(dup.status, "fail");
  assert.match(dup.detail, /exact copy/);
  assert.equal(dup.refs![0].campaignId, "maya");
});

test("care receipt: verified pharmacy, balloon excluded, paid amount within the 10% cap", async () => {
  const c: Campaign = {
    id: "maya", createdAt: "", status: "live", currency: "USD", organizer: { name: "", email: "", relationship: "" }, providerId: riverside.id,
    patient: { displayName: "Maya R.", age: 9 }, title: "", story: "", facts: [], goal: "2400.00", docs: mayaDocs, donations: [], careCosts: [], movements: [], events: [],
  };
  const rx = doc("r1", "receipt", "maya-pharmacy-receipt.png");
  const k = await reviewReceipt({ campaign: c, doc: rx, prior: [], on: ON });
  assert.equal(k.status, "approved", JSON.stringify(k.checks.filter((x) => x.status !== "pass"), null, 2));
  assert.equal(k.issuer, "CityCare Pharmacy");
  assert.equal(k.claimed, 70.5);
  assert.equal(k.approved, 64.5);
  assert.equal(careRoom(c).cap, 240);
});

test("care receipt from an unverified shop is held, not paid", async () => {
  const c: Campaign = {
    id: "maya", createdAt: "", status: "live", currency: "USD", organizer: { name: "", email: "", relationship: "" }, providerId: riverside.id,
    patient: { displayName: "Maya R.", age: 9 }, title: "", story: "", facts: [], goal: "2400.00", docs: mayaDocs, donations: [], careCosts: [], movements: [], events: [],
  };
  const rx = doc("r2", "receipt", "maya-pharmacy-receipt.png");
  rx.extraction!.providerName = "Joe's Discount Electronics";
  const k = await reviewReceipt({ campaign: c, doc: rx, prior: [], on: ON });
  assert.equal(k.status, "held");
  assert.equal(k.approved, 0);
});
