import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { planOffers } from "../src/lib/forward";

// "Pass it on": what the bill didn't need is never charged; donors who asked are offered another
// verified patient, as a NEW hold. End to end on the JSON store in mock PayPal mode.
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "earmark-fwd-"));
delete process.env.PAYPAL_CLIENT_ID;
delete process.env.DATABASE_URL;
for (const k of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY"]) delete process.env[k];

test("planOffers: one offer per donor, never more than the target needs, tiny leftovers skipped", () => {
  const p = planOffers(
    [{ id: "grace", neverChargedCents: 5000 }, { id: "work", neverChargedCents: 12000 }, { id: "sam", neverChargedCents: 300 }],
    [{ id: "aarav", needsCents: 15000 }],
  );
  assert.deepEqual(p.map((x) => [x.donorId, x.amountCents]), [["work", 12000], ["grace", 3000]]);
  assert.ok(!p.some((x) => x.donorId === "sam"), "a $3 leftover isn't worth PayPal's fees");
  assert.equal(p.reduce((s, x) => s + x.amountCents, 0), 15000, "offers never exceed the need, so they can't rebuild a surplus");
});

test("only donors who asked get an offer; accepting it is a new hold on the other campaign", async () => {
  const wf = await import("../src/lib/workflow");
  const store = await import("../src/lib/store");
  const file = (n: string) => ({ filename: n, buf: readFileSync(path.join("public", "samples", n)) });
  const org = { name: "Elena", email: "e@example.com", relationship: "Mother" };
  const maya = await wf.createCampaign({ organizer: org, providerId: "prov_riverside", title: "Maya", story: "", files: [{ kind: "estimate", ...file("maya-estimate.png") }, { kind: "identity", ...file("maya-registration.png") }, { kind: "medical_note", ...file("maya-clinical-note.png") }] });
  const aarav = await wf.createCampaign({ organizer: { ...org, name: "Priya" }, providerId: "prov_riverside", title: "Aarav", story: "", files: [{ kind: "estimate", ...file("aarav-estimate.png") }, { kind: "identity", ...file("aarav-registration.png") }] });
  assert.equal(maya.status, "live");
  assert.equal(aarav.status, "live", "Aarav's genuine estimate verifies (hospital confirms it)");

  await wf.simulateDonors(maya.id); // $2,600 pledged; Grace, Mei and the coworkers chose "offer"
  const pledged = (await store.getCampaign(maya.id))!.donations.filter((d) => d.status === "held");
  assert.equal(pledged.length, 8);
  await assert.rejects(wf.createDonationOrder(maya.id, { donorName: "Late", donorEmail: "l@example.com", amount: "100", anonymous: false, message: "" }), /fully pledged/, "pledges close once the goal is reached");

  const settled = await wf.submitFinalBill(maya.id, file("maya-final-bill.png"));
  assert.equal(settled.status, "settled");
  const offered = settled.donations.filter((d) => d.offer);
  assert.deepEqual(offered.map((d) => d.donorName).sort(), ["Coworkers at Hollis & Co.", "Grace", "Mei"]);
  for (const d of settled.donations) {
    if (d.surplus !== "offer") assert.equal(d.offer, undefined, "silence moves nothing");
    assert.ok(Number(d.captured) <= Number(d.pledged), "nobody pays more than they pledged");
  }
  const grace = offered.find((d) => d.donorName === "Grace")!;
  assert.equal(grace.offer!.campaignId, aarav.id);
  assert.ok(Number(grace.offer!.amount) <= Number(grace.neverCharged), "an offer is at most what the bill didn't need");

  // Over the offer: refused. At the offer: a brand-new authorization on Aarav's campaign.
  await assert.rejects(wf.createDonationOrder(aarav.id, { donorName: "Grace", donorEmail: "g@example.com", amount: String(Number(grace.offer!.amount) + 1), anonymous: false, message: "", fromOffer: { campaignId: maya.id, donationId: grace.id } }), /up to/);
  const o = await wf.createDonationOrder(aarav.id, { donorName: "Grace", donorEmail: "g@example.com", amount: grace.offer!.amount, anonymous: false, message: "", fromOffer: { campaignId: maya.id, donationId: grace.id } });
  const a2 = await wf.confirmDonation(aarav.id, o.donationId, o.orderId);
  const nd = a2.donations.find((d) => d.id === o.donationId)!;
  assert.equal(nd.status, "held");
  assert.notEqual(nd.authorizationId, grace.authorizationId, "never the old hold");
  assert.equal(nd.forwardedFrom?.donationId, grace.id);
  const after = (await store.getCampaign(maya.id))!.donations.find((d) => d.id === grace.id)!;
  assert.equal(after.offer!.status, "accepted");
  await assert.rejects(wf.createDonationOrder(aarav.id, { donorName: "Grace", donorEmail: "g@example.com", amount: "1", anonymous: false, message: "", fromOffer: { campaignId: maya.id, donationId: grace.id } }), /expired or was already used/, "an offer is used once");

  const mei = offered.find((d) => d.donorName === "Mei")!;
  await wf.declineOffer(maya.id, mei.id);
  assert.equal((await store.getCampaign(maya.id))!.donations.find((d) => d.id === mei.id)!.offer!.status, "declined");
});
