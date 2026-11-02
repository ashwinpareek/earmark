import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Doc } from "../src/lib/types";

// The AI's reading of a file is remembered by its SHA-256: the same bytes are read once, so a
// judge reopening a demo (or the next judge) doesn't wait on the AI again.
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "earmark-cache-"));

test("the same file is read by the AI once, then served from the cache", async () => {
  const { readDocument } = await import("../src/lib/reader");
  const realFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = "test";
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    const text = JSON.stringify({ docType: "estimate", providerName: "Riverside Children's Hospital", total: 100, currency: "USD", lineItems: [], tamperSignals: [], instructionsToReader: "", readerConfidence: 0.9 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
  }) as typeof fetch;
  try {
    const doc = { id: "d1", kind: "estimate", filename: "x.png", mime: "image/png", sha256: "f".repeat(64), size: 3, uploadedAt: "", uploadedBy: "organizer" } as Doc;
    const a = await readDocument(doc, Buffer.from("abc"));
    const b = await readDocument({ ...doc, id: "d2" }, Buffer.from("abc"));
    assert.equal(calls, 1, "the second read must not call the AI");
    assert.deepEqual(b.extraction, a.extraction);
    assert.equal(b.model, a.model);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.GEMINI_API_KEY;
  }
});
