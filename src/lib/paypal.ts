import { uid, nowIso } from "./util";

// PayPal REST integration (sandbox).
//
// Money flow per milestone:
//   1. createAuthorizeOrder  → Orders v2, intent=AUTHORIZE (client approves in PayPal popup)
//   2. authorizeOrder        → funds are RESERVED on the client's account, nothing is taken yet
//   3a. captureAuthorization → full or PARTIAL capture once the AI verdict passes the policy
//   3b. voidAuthorization    → releases any uncaptured remainder back to the client
//   4. createPayout          → Payouts API sends the captured amount to the freelancer's PayPal
//
// Every mutating call sends a PayPal-Request-Id so retries are idempotent.

const BASE = "https://api-m.sandbox.paypal.com";

export type PayPalMode = "sandbox" | "mock";

export function paypalMode(): PayPalMode {
  if (process.env.PAYPAL_MODE === "mock") return "mock";
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) return "mock";
  return "sandbox";
}

export class PayPalError extends Error {
  constructor(
    message: string,
    public status: number,
    public issue?: string,
    public debugId?: string,
  ) {
    super(message);
  }
}

type G = typeof globalThis & { __ppToken?: { token: string; exp: number } };
const g = globalThis as G;

async function accessToken(): Promise<string> {
  if (g.__ppToken && g.__ppToken.exp > Date.now() + 60_000) return g.__ppToken.token;
  const basic = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
  ).toString("base64");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new PayPalError(`PayPal auth failed (${res.status}). Check PAYPAL_CLIENT_ID/SECRET.`, res.status);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  g.__ppToken = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

async function pp<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: { requestId?: string; extraHeaders?: Record<string, string> } = {},
): Promise<T> {
  const token = await accessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...opts.extraHeaders,
  };
  if (opts.requestId) headers["PayPal-Request-Id"] = opts.requestId;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const issue = json?.details?.[0]?.issue ?? json?.name;
    const desc = json?.details?.[0]?.description ?? json?.message ?? `HTTP ${res.status}`;
    throw new PayPalError(`PayPal ${method} ${path}: ${issue ?? ""} ${desc}`.trim(), res.status, issue, json?.debug_id);
  }
  return json as T;
}

// ─── Orders / authorizations ────────────────────────────────────────

export interface CreateOrderInput {
  amount: string;
  currency: string;
  description: string;
  customId: string; // `${campaignId}:${donationId}` — lets webhooks find the donation
  invoiceId: string;
  returnUrl: string;
  cancelUrl: string;
  /** Direct mode: the provider is the payee, so captured money lands in ITS PayPal account and
   *  never passes through the platform. Requires PayPal multiparty (approved partner) permissions. */
  payeeEmail?: string;
}

export async function createAuthorizeOrder(input: CreateOrderInput): Promise<{ id: string; approveUrl?: string }> {
  if (paypalMode() === "mock") return { id: uid("MOCKORDER").toUpperCase() };
  const order = await pp<{ id: string; links: { rel: string; href: string }[] }>(
    "POST",
    "/v2/checkout/orders",
    {
      intent: "AUTHORIZE",
      purchase_units: [
        {
          reference_id: input.customId.slice(0, 256),
          custom_id: input.customId.slice(0, 127),
          invoice_id: input.invoiceId.slice(0, 127),
          description: input.description.slice(0, 127),
          soft_descriptor: "EARMARK DONATION",
          amount: { currency_code: input.currency, value: input.amount },
          ...(input.payeeEmail ? { payee: { email_address: input.payeeEmail } } : {}),
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "Earmark",
            shipping_preference: "NO_SHIPPING",
            user_action: "CONTINUE",
            return_url: input.returnUrl,
            cancel_url: input.cancelUrl,
          },
        },
      },
    },
    { requestId: `order-${input.invoiceId}-${Date.now()}` },
  );
  return { id: order.id, approveUrl: order.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href };
}

export interface AuthorizationResult {
  authorizationId: string;
  status: string;
  expiresAt?: string;
  amount: string;
  currency: string;
  payerEmail?: string;
}

export async function authorizeOrder(orderId: string): Promise<AuthorizationResult> {
  if (paypalMode() === "mock") {
    return {
      authorizationId: uid("MOCKAUTH").toUpperCase(),
      status: "CREATED",
      expiresAt: new Date(Date.now() + 29 * 864e5).toISOString(),
      amount: "0",
      currency: "USD",
      payerEmail: "mock-buyer@personal.example.com",
    };
  }
  type Auth = { id: string; status: string; expiration_time?: string; amount: { value: string; currency_code: string } };
  const res = await pp<{
    payer?: { email_address?: string };
    purchase_units: { payments: { authorizations: Auth[] } }[];
  }>("POST", `/v2/checkout/orders/${orderId}/authorize`, {}, { requestId: `authorize-${orderId}` });
  const auth = res.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!auth) throw new PayPalError("Authorization missing from PayPal response", 500);
  return {
    authorizationId: auth.id,
    status: auth.status,
    expiresAt: auth.expiration_time,
    amount: auth.amount.value,
    currency: auth.amount.currency_code,
    payerEmail: res.payer?.email_address,
  };
}

export async function getOrder(orderId: string) {
  if (paypalMode() === "mock") return { id: orderId, status: "APPROVED" };
  return pp<{ id: string; status: string }>("GET", `/v2/checkout/orders/${orderId}`);
}

export async function captureAuthorization(args: {
  authorizationId: string;
  amount: string;
  currency: string;
  finalCapture: boolean;
  invoiceId: string;
  note: string;
}): Promise<{ captureId: string; status: string }> {
  if (paypalMode() === "mock") return { captureId: uid("MOCKCAP").toUpperCase(), status: "COMPLETED" };
  const res = await pp<{ id: string; status: string }>(
    "POST",
    `/v2/payments/authorizations/${args.authorizationId}/capture`,
    {
      amount: { currency_code: args.currency, value: args.amount },
      final_capture: args.finalCapture,
      invoice_id: args.invoiceId.slice(0, 127),
      note_to_payer: args.note.slice(0, 255),
      soft_descriptor: "EARMARK DONATION",
    },
    { requestId: `capture-${args.authorizationId}-${args.amount}` },
  );
  return { captureId: res.id, status: res.status };
}

export async function voidAuthorization(authorizationId: string): Promise<{ status: string }> {
  if (paypalMode() === "mock") return { status: "VOIDED" };
  await pp("POST", `/v2/payments/authorizations/${authorizationId}/void`, undefined, {
    requestId: `void-${authorizationId}`,
  });
  return { status: "VOIDED" };
}

export async function reauthorize(authorizationId: string, amount: string, currency: string) {
  if (paypalMode() === "mock") return { authorizationId: uid("MOCKAUTH").toUpperCase(), status: "CREATED" };
  const res = await pp<{ id: string; status: string; expiration_time?: string }>(
    "POST",
    `/v2/payments/authorizations/${authorizationId}/reauthorize`,
    { amount: { currency_code: currency, value: amount } },
    { requestId: `reauth-${authorizationId}-${Date.now()}` },
  );
  return { authorizationId: res.id, status: res.status, expiresAt: res.expiration_time };
}

// ─── Payouts ────────────────────────────────────────────────────────

export async function createPayout(args: {
  items: { receiverEmail: string; amount: string; note: string; ref: string }[];
  currency: string;
  senderBatchId: string;
  subject?: string;
}): Promise<{ batchId: string; status: string }> {
  if (paypalMode() === "mock") return { batchId: uid("MOCKBATCH").toUpperCase(), status: "SUCCESS" };
  const res = await pp<{ batch_header: { payout_batch_id: string; batch_status: string } }>(
    "POST",
    "/v1/payments/payouts",
    {
      sender_batch_header: {
        sender_batch_id: args.senderBatchId,
        email_subject: args.subject ?? "Earmark: payment for a verified patient bill",
        email_message: "Donations raised on Earmark for a verified patient bill.",
      },
      items: args.items.map((it) => ({
        recipient_type: "EMAIL",
        receiver: it.receiverEmail,
        amount: { value: it.amount, currency: args.currency },
        note: it.note.slice(0, 4000),
        sender_item_id: it.ref.slice(0, 63),
      })),
    },
    { requestId: `payout-${args.senderBatchId}` },
  );
  return { batchId: res.batch_header.payout_batch_id, status: res.batch_header.batch_status };
}

export const payeeMode = (): "payout" | "direct" => (process.env.PAYEE_MODE === "direct" ? "direct" : "payout");

// ─── Webhooks ───────────────────────────────────────────────────────

export async function verifyWebhook(headers: Headers, rawBody: string): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (paypalMode() === "mock" || !webhookId) return false;
  const res = await pp<{ verification_status: string }>("POST", "/v1/notifications/verify-webhook-signature", {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: webhookId,
    webhook_event: JSON.parse(rawBody),
  });
  return res.verification_status === "SUCCESS";
}

export const paypalNow = nowIso;
