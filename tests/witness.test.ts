import { test } from "node:test";
import assert from "node:assert/strict";
import { compare, guardToolCall, WITNESS_TOOLS } from "../src/lib/witness";
import type { Campaign, Donation } from "../src/lib/types";

// The second witness: Earmark's ledger checked against PayPal's own records (via PayPal's Agent Toolkit).

test("the witness is read-only: one tool, get_order, and nothing that moves money", () => {
  assert.deepEqual([...WITNESS_TOOLS], ["get_order"]);
  for (const t of ["pay_order", "create_refund", "create_order", "create_invoice", "cancel_subscription", "accept_dispute_claim"]) {
    assert.equal(guardToolCall(t, { id: "5O190127TN364715T" }).ok, false, `${t} must be refused`);
  }
  assert.equal(guardToolCall("get_order", { id: "5O190127TN364715T" }).ok, true);
  assert.equal(guardToolCall("get_order", { id: "../../v1/payments/payouts" }).ok, false, "only real order IDs");
});

test("the toolkit is pointed at the sandbox (it defaults to live)", async () => {
  const { PayPalAgentToolkit } = await import("@paypal/agent-toolkit/openai");
  const t = new PayPalAgentToolkit({ clientId: "x", clientSecret: "y", configuration: { actions: { orders: { get: true } }, context: { sandbox: true } } }) as unknown as { _paypal: { baseUrl: string }; getTools(): { function: { name: string } }[] };
  assert.match(t._paypal.baseUrl, /sandbox/);
  assert.deepEqual(t.getTools().map((x) => x.function.name), ["get_order"]);
});

const c = { id: "c1", currency: "USD", providerId: "prov_riverside" } as Campaign;
const d = { id: "d1", status: "captured", pledged: "500.00", captured: "441.35", neverCharged: "58.65", authorizationId: "AUTH1", orderId: "ORDER1" } as Donation;
const order = (authStatus: string, capValue: string | null, finalCapture = true) => ({
  status: "COMPLETED",
  purchase_units: [{ payments: { authorizations: [{ id: "AUTH1", status: authStatus }], captures: capValue ? [{ id: "CAP1", status: "COMPLETED", final_capture: finalCapture, amount: { value: capValue, currency_code: "USD" } }] : [] } }],
});

test("PayPal agrees when the hold was closed and the right amount collected", () => {
  const w = compare(c, d, order("CAPTURED", "441.35"), "paypal-agent-toolkit");
  assert.equal(w.agrees, true, JSON.stringify(w.checked));
});

test("a different captured amount is a mismatch", () => {
  const w = compare(c, d, order("CAPTURED", "500.00"), "paypal-agent-toolkit");
  assert.equal(w.agrees, false);
  assert.ok(w.checked.some((k) => k.what === "Amount collected" && !k.ok));
});

test("a hold left open after collecting is a mismatch (the rest wasn't released)", () => {
  const w = compare(c, d, order("PARTIALLY_CAPTURED", "441.35", false), "paypal-agent-toolkit");
  assert.equal(w.agrees, false);
  assert.ok(w.checked.some((k) => k.what === "Rest of the pledge" && !k.ok));
});

// Found in the first live sandbox run: in payout mode PayPal collects into Earmark's platform account,
// so the order's payee is never the hospital. The hospital is checked through the Payouts row instead.
test("payout mode: the platform account as payee is expected, not a mismatch", () => {
  const o = { ...order("CAPTURED", "441.35"), purchase_units: [{ ...order("CAPTURED", "441.35").purchase_units[0], payee: { email_address: "platform@business.example.com" } }] };
  assert.equal(compare(c, d, o, "paypal-agent-toolkit", "payout").agrees, true);
  const direct = compare(c, d, o, "paypal-agent-toolkit", "direct");
  assert.equal(direct.agrees, false);
  assert.ok(direct.checked.some((k) => k.what === "Who the money is for" && !k.ok));
});
