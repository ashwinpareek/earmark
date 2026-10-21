import type { Campaign, Donation } from "./types";
import { provider } from "./providers";
import { fmtMoney } from "./util";

// THE SECOND WITNESS — Earmark's ledger, checked by PayPal's own AI tooling.
//
// Earmark's ledger says what happened to a pledge. This module asks PayPal independently, through
// PayPal's Agent Toolkit (@paypal/agent-toolkit, the tool layer PayPal ships for AI agents), and
// compares the two. The Earmark auditor agent can call it, and every donor receipt has a button.
//
// Read-only by construction. The toolkit can also create orders, pay them and issue refunds, and
// its handleToolCall() runs whatever tool name it's given, even ones the configuration didn't
// enable. So the witness enforces its own allowlist: exactly one tool, get_order. That rule is
// unit-tested, and tests/boundary.test.ts keeps every money-moving call inside the workflow.

export const WITNESS_TOOLS = ["get_order"] as const;
const ORDER_ID = /^[A-Z0-9]{17,32}$/;

type PayPalOrder = {
  id?: string;
  status?: string;
  purchase_units?: {
    payee?: { email_address?: string; merchant_id?: string };
    payments?: {
      authorizations?: { id: string; status: string; amount?: { value: string; currency_code: string } }[];
      captures?: { id: string; status: string; final_capture?: boolean; amount?: { value: string; currency_code: string } }[];
    };
  }[];
  error?: { message?: string };
};

export type Witness = {
  source: "paypal-agent-toolkit" | "mock";
  tool: string;
  agrees: boolean;
  checked: { what: string; earmark: string; paypal: string; ok: boolean }[];
  paypal: { orderStatus?: string; authorizationStatus?: string; captured: string; captureIds: string[] };
  note: string;
};

/** A tool call the witness will run, or a refusal. Exported for tests. */
export function guardToolCall(name: string, args: Record<string, unknown>): { ok: true } | { ok: false; why: string } {
  if (!(WITNESS_TOOLS as readonly string[]).includes(name)) return { ok: false, why: `The witness is read-only: "${name}" isn't allowed.` };
  if (typeof args.id !== "string" || !ORDER_ID.test(args.id)) return { ok: false, why: "Not a PayPal order ID." };
  return { ok: true };
}

type Toolkit = { handleToolCall(c: { id: string; type: "function"; function: { name: string; arguments: string } }): Promise<{ content: unknown }> };
type G = typeof globalThis & { __ppWitness?: Toolkit };

async function toolkit(): Promise<Toolkit> {
  const g = globalThis as G;
  if (!g.__ppWitness) {
    const { PayPalAgentToolkit } = await import("@paypal/agent-toolkit/openai");
    g.__ppWitness = new PayPalAgentToolkit({
      clientId: process.env.PAYPAL_CLIENT_ID!,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET!,
      // sandbox must be explicit: the toolkit defaults to the LIVE API.
      configuration: { actions: { orders: { get: true } }, context: { sandbox: true } },
    }) as unknown as Toolkit;
  }
  return g.__ppWitness;
}

async function getOrder(orderId: string): Promise<PayPalOrder> {
  const args = { id: orderId };
  const guard = guardToolCall("get_order", args);
  if (!guard.ok) throw new Error(guard.why);
  const r = await (await toolkit()).handleToolCall({ id: `witness-${orderId}`, type: "function", function: { name: "get_order", arguments: JSON.stringify(args) } });
  const order = (typeof r.content === "string" ? JSON.parse(r.content) : r.content) as PayPalOrder;
  if (order?.error) throw new Error(order.error.message ?? "PayPal returned an error");
  return order;
}

const cents = (v?: string | number) => Math.round(Number(v ?? 0) * 100);

/** Compare Earmark's record of one pledge with what PayPal itself reports. */
export function compare(c: Campaign, d: Donation, order: PayPalOrder, source: Witness["source"]): Witness {
  const pu = order.purchase_units?.[0];
  const auth = pu?.payments?.authorizations?.find((a) => a.id === d.authorizationId) ?? pu?.payments?.authorizations?.[0];
  const caps = (pu?.payments?.captures ?? []).filter((x) => x.status === "COMPLETED" || x.status === "PENDING");
  const captured = caps.reduce((s, x) => s + cents(x.amount?.value), 0);
  const cur = c.currency;
  const checked: Witness["checked"] = [];
  const expectAuth =
    d.status === "held" ? ["CREATED"] : d.status === "captured" ? ["CAPTURED", "PARTIALLY_CAPTURED"] : d.status === "voided" ? ["VOIDED"] : d.status === "lapsed" ? ["EXPIRED", "VOIDED", "DENIED"] : [];
  checked.push({ what: "The hold", earmark: d.status, paypal: auth?.status ?? "not found", ok: !!auth && (expectAuth.length === 0 || expectAuth.includes(auth.status)) });
  checked.push({ what: "Amount collected", earmark: fmtMoney((d.captured ?? "0"), cur), paypal: fmtMoney(captured / 100, cur), ok: captured === cents(d.captured ?? 0) });
  if (cents(d.captured) > 0) {
    // final_capture: true closes the authorization, so PayPal itself has released the rest.
    const closed = auth?.status === "CAPTURED" || caps.some((x) => x.final_capture);
    checked.push({ what: "Rest of the pledge", earmark: `${fmtMoney(d.neverCharged ?? "0", cur)} released`, paypal: closed ? "hold closed (final capture)" : "hold still open", ok: closed });
  }
  if (cents(d.captured) > cents(d.pledged)) checked.push({ what: "Never above the pledge", earmark: fmtMoney(d.pledged, cur), paypal: fmtMoney(captured / 100, cur), ok: false });
  const hosp = provider(c.providerId);
  const payee = pu?.payee?.email_address;
  if (payee && hosp) checked.push({ what: "Who the money is for", earmark: hosp.name, paypal: payee.toLowerCase() === hosp.paypalEmail.toLowerCase() ? `${hosp.name}'s registered account` : "a different account", ok: payee.toLowerCase() === hosp.paypalEmail.toLowerCase() });
  const agrees = checked.every((k) => k.ok);
  return {
    source,
    tool: "get_order",
    agrees,
    checked,
    paypal: { orderStatus: order.status, authorizationStatus: auth?.status, captured: (captured / 100).toFixed(2), captureIds: caps.map((x) => x.id) },
    note: source === "mock"
      ? "Mock mode: there is no real PayPal to ask, so this replays Earmark's own record. With sandbox keys, PayPal's Agent Toolkit answers."
      : agrees
        ? "PayPal's own records, read through PayPal's Agent Toolkit, match Earmark's ledger."
        : "PayPal's records and Earmark's ledger disagree. Earmark shows the payment as unconfirmed until this is resolved.",
  };
}

/** Mock mode: build the order PayPal would return, from Earmark's own record (clearly labelled). */
function mockOrder(c: Campaign, d: Donation): PayPalOrder {
  const st = { held: "CREATED", captured: "CAPTURED", voided: "VOIDED", lapsed: "EXPIRED", failed: "DENIED", pending: "CREATED" }[d.status];
  return {
    id: d.orderId,
    status: d.status === "pending" ? "CREATED" : "COMPLETED",
    purchase_units: [{ payments: { authorizations: [{ id: d.authorizationId ?? "", status: st }], captures: cents(d.captured) > 0 ? [{ id: d.captureId ?? "", status: "COMPLETED", final_capture: true, amount: { value: d.captured!, currency_code: c.currency } }] : [] } }],
  };
}

export async function witnessDonation(c: Campaign, d: Donation, mode: "sandbox" | "mock"): Promise<Witness> {
  if (!d.orderId) throw new Error("This pledge has no PayPal order yet.");
  if (mode === "mock") return compare(c, d, mockOrder(c, d), "mock");
  return compare(c, d, await getOrder(d.orderId), "paypal-agent-toolkit");
}
