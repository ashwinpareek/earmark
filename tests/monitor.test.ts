import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// The daily hold monitor, end to end on the JSON store in mock PayPal mode.
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "earmark-"));
delete process.env.PAYPAL_CLIENT_ID;
delete process.env.DATABASE_URL;
for (const k of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY"]) delete process.env[k];

test("renews holds past the honor period once, and lapses expired ones", async () => {
  const wf = await import("../src/lib/workflow");
  const store = await import("../src/lib/store");
  const file = (n: string) => ({ filename: n, buf: readFileSync(path.join("public", "samples", n)) });
  const c = await wf.createCampaign({
    organizer: { name: "Elena", email: "e@example.com", relationship: "Mother" },
    providerId: "prov_riverside", title: "Maya", story: "",
    files: [{ kind: "estimate", ...file("maya-estimate.png") }, { kind: "identity", ...file("maya-registration.png") }, { kind: "medical_note", ...file("maya-clinical-note.png") }],
  });
  assert.equal(c.status, "live");
  await wf.simulateDonors(c.id);
  const now = new Date();
  await store.updateCampaign(c.id, (cc) => {
    const held = cc.donations.filter((d) => d.status === "held");
    held[0].authorizedAt = new Date(now.getTime() - 5 * 864e5).toISOString(); // past honor period
    held[1].authorizedAt = new Date(now.getTime() - 30 * 864e5).toISOString(); // past 29 days
    for (const d of held.slice(2)) d.authorizedAt = now.toISOString(); // fresh
  });
  const r1 = await wf.monitorHolds(now);
  assert.equal(r1.renewed, 1);
  assert.equal(r1.lapsed, 1);
  const r2 = await wf.monitorHolds(now);
  assert.equal(r2.renewed, 0, "a hold is renewed only once");
  const after = (await store.getCampaign(c.id))!;
  assert.equal(after.donations.filter((d) => d.status === "lapsed").length, 1);
  assert.ok(after.donations.some((d) => d.reauthorizedAt));
});
