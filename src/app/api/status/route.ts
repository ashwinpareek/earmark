import { NextResponse } from "next/server";
import { paypalMode } from "@/lib/paypal";
import { aiProvider, aiModelName } from "@/lib/ai";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({
    paypal: paypalMode(),
    paypalClientId: paypalMode() === "sandbox" ? process.env.PAYPAL_CLIENT_ID : null,
    webhookVerification: Boolean(process.env.PAYPAL_WEBHOOK_ID),
    ai: aiProvider(),
    model: aiModelName(),
  });
}
