import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Fixes from running PayPal's AI Toolkit "PayPal Doctor" checklist over Earmark.
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "earmark-doc-"));
delete process.env.DATABASE_URL;

test("state-changing routes refuse cross-site POSTs (CSRF)", async () => {
  const { sameOrigin } = await import("../src/lib/http");
  const req = (origin: string | null, host = "earmark.onrender.com") => new Request("https://earmark.onrender.com/api/x", { method: "POST", headers: { host, ...(origin ? { origin } : {}) } });
  assert.doesNotThrow(() => sameOrigin(req("https://earmark.onrender.com")));
  assert.doesNotThrow(() => sameOrigin(req(null)), "server-to-server calls carry no Origin");
  assert.throws(() => sameOrigin(req("https://evil.example")), /Cross-site/);
  assert.throws(() => sameOrigin(req("null")), /Cross-site/);
});

test("a redelivered webhook event is processed once", async () => {
  const { recordWebhook } = await import("../src/lib/store");
  assert.equal(await recordWebhook({ id: "WH-1", type: "PAYMENT.CAPTURE.COMPLETED", verified: true }), false);
  assert.equal(await recordWebhook({ id: "WH-1", type: "PAYMENT.CAPTURE.COMPLETED", verified: true }), true);
  assert.equal(await recordWebhook({ id: "WH-2", type: "PAYMENT.CAPTURE.COMPLETED", verified: false }), false, "unverified events never count as processed");
  assert.equal(await recordWebhook({ id: "WH-2", type: "PAYMENT.CAPTURE.COMPLETED", verified: true }), false);
});
