import { NextResponse } from "next/server";
import { verifyWebhook, paypalMode } from "@/lib/paypal";
import { recordWebhook } from "@/lib/store";
import { onWebhook } from "@/lib/workflow";

export const dynamic = "force-dynamic";

// Subscribe in the PayPal developer dashboard to: PAYMENT.AUTHORIZATION.CREATED, PAYMENT.AUTHORIZATION.VOIDED,
// PAYMENT.CAPTURE.COMPLETED, PAYMENT.PAYOUTS-ITEM.SUCCEEDED, PAYMENT.PAYOUTS-ITEM.FAILED.
export async function POST(req: Request) {
  const raw = await req.text();
  let event: { id: string; event_type: string; resource: Record<string, unknown> };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "not JSON" }, { status: 200 });
  }
  let verified = false;
  try { verified = await verifyWebhook(req.headers, raw); } catch { verified = false; }
  // A forged or unverifiable event gets a 200 too (so nobody can probe or replay against us),
  // but it is only logged: it can never confirm a money movement.
  if (paypalMode() === "sandbox" && process.env.PAYPAL_WEBHOOK_ID && !verified) {
    await recordWebhook({ id: String(event.id ?? ""), type: String(event.event_type ?? ""), verified: false });
    return NextResponse.json({ ok: true, verified: false, result: "ignored: signature verification failed" });
  }
  const duplicate = await recordWebhook({ id: event.id, type: event.event_type, verified });
  // PayPal redelivers events: each verified event id is processed once.
  if (duplicate) return NextResponse.json({ ok: true, verified, result: "duplicate: already processed" });
  const result = verified ? await onWebhook(event).catch((e) => `error: ${(e as Error).message}`) : "logged only (unverified: set PAYPAL_WEBHOOK_ID)";
  return NextResponse.json({ ok: true, verified, result });
}
