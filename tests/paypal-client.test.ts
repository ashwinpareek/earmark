import { test } from "node:test";
import assert from "node:assert/strict";

// The PayPal client's failure handling, against a fake PayPal (no network).
process.env.PAYPAL_CLIENT_ID = "test-id";
process.env.PAYPAL_CLIENT_SECRET = "test-secret";
process.env.PAYPAL_TIMEOUT_MS = "300";
delete process.env.PAYPAL_MODE;

type Call = { url: string; method: string; requestId?: string; auth?: string };
const calls: Call[] = [];
let script: ((c: Call) => Response | Promise<Response>)[] = [];
const json = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const h = new Headers(init?.headers);
  const c: Call = { url: String(input), method: init?.method ?? "GET", requestId: h.get("PayPal-Request-Id") ?? undefined, auth: h.get("Authorization") ?? undefined };
  calls.push(c);
  if (c.url.endsWith("/v1/oauth2/token")) return json(200, { access_token: `tok${calls.filter((x) => x.url.endsWith("/token")).length}`, expires_in: 3600 });
  const step = script.shift();
  if (!step) throw new Error("unexpected call " + c.url);
  // Like real fetch: an aborted signal rejects the request.
  const signal = init?.signal;
  return Promise.race([
    Promise.resolve(step(c)),
    new Promise<Response>((_, rej) => signal?.addEventListener("abort", () => rej(Object.assign(new Error("timed out"), { name: "TimeoutError" })))),
  ]);
}) as typeof fetch;

const reset = (s: typeof script) => {
  calls.length = 0;
  script = s;
  delete (globalThis as { __ppToken?: unknown }).__ppToken;
};
const api = () => calls.filter((c) => !c.url.endsWith("/token"));

test("a capture retried after a 503 reuses the same PayPal-Request-Id (no double charge)", async () => {
  const pp = await import("../src/lib/paypal");
  reset([() => json(503, { name: "SERVICE_UNAVAILABLE" }), () => json(201, { id: "CAP1", status: "COMPLETED" })]);
  const r = await pp.captureAuthorization({ authorizationId: "AUTH1", amount: "90.00", currency: "USD", finalCapture: true, invoiceId: "d1-cap", note: "n" });
  assert.equal(r.captureId, "CAP1");
  assert.equal(api().length, 2);
  assert.equal(api()[0].requestId, api()[1].requestId);
  assert.ok(api()[0].requestId);
});

test("429 honours Retry-After and then succeeds", async () => {
  const pp = await import("../src/lib/paypal");
  reset([() => json(429, { name: "RATE_LIMIT_REACHED" }, { "retry-after": "0" }), () => json(200, { status: "CREATED", expiration_time: new Date(Date.now() + 864e5).toISOString() })]);
  const a = await pp.getAuthorization("AUTH2");
  assert.equal(a.usable, true);
});

test("a stalled request times out instead of hanging the settlement", async () => {
  const pp = await import("../src/lib/paypal");
  const stall = () => new Promise<Response>((r) => setTimeout(() => r(json(200, {})), 1500));
  reset([stall, stall, stall]);
  const t = Date.now();
  await assert.rejects(pp.getCapture("CAP9"), /no response/);
  assert.ok(Date.now() - t < 3000);
});

test("an expired token is refreshed once on 401", async () => {
  const pp = await import("../src/lib/paypal");
  reset([() => json(401, { name: "AUTHENTICATION_FAILURE" }), () => json(200, { status: "COMPLETED" })]);
  const r = await pp.getCapture("CAP3");
  assert.equal(r.status, "COMPLETED");
  assert.notEqual(api()[0].auth, api()[1].auth, "the retry used a new token");
});

test("a business error (422) is not retried", async () => {
  const pp = await import("../src/lib/paypal");
  reset([() => json(422, { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "AUTHORIZATION_VOIDED", description: "voided" }] })]);
  await assert.rejects(pp.voidAuthorization("AUTH4"), /AUTHORIZATION_VOIDED/);
  assert.equal(api().length, 1);
});
