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
    // A PayPal SANDBOX test buyer for judges (fake account, fake money). Set on the server, never
    // committed; only ever shown when the app runs against the sandbox.
    judgeLogin: paypalMode() === "sandbox" && process.env.JUDGE_BUYER_EMAIL && process.env.JUDGE_BUYER_PASSWORD
      ? { email: process.env.JUDGE_BUYER_EMAIL, password: process.env.JUDGE_BUYER_PASSWORD }
      : null,
  });
}
