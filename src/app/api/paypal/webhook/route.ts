import { NextResponse } from "next/server";
import { verifyWebhook, paypalMode } from "@/lib/paypal";
import { recordWebhook } from "@/lib/store";
import { onWebhook } from "@/lib/workflow";

export const dynamic = "force-dynamic";

// Subscribe in the PayPal developer dashboard to: PAYMENT.AUTHORIZATION.CREATED, PAYMENT.AUTHORIZATION.VOIDED,
// PAYMENT.CAPTURE.COMPLETED, PAYMENT.PAYOUTS-ITEM.SUCCEEDED, PAYMENT.PAYOUTS-ITEM.FAILED.
export async function POST(req: Request) {
  const raw = await req.text();
  let verified = false;
  try { verified = await verifyWebhook(req.headers, raw); } catch { verified = false; }
  if (paypalMode() === "sandbox" && process.env.PAYPAL_WEBHOOK_ID && !verified) {
    return NextResponse.json({ error: "signature verification failed" }, { status: 400 });
  }
  const event = JSON.parse(raw) as { id: string; event_type: string; resource: Record<string, unknown> };
  await recordWebhook({ id: event.id, type: event.event_type, verified });
  // Only signature-verified events may confirm money movements; anything else is just logged.
  const result = verified ? await onWebhook(event).catch((e) => `error: ${(e as Error).message}`) : "logged only (unverified: set PAYPAL_WEBHOOK_ID)";
  return NextResponse.json({ ok: true, verified, result });
}
