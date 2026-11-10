import { z } from "zod";
import { handle, rateLimit } from "@/lib/http";
import { canonical, intentWithinMandate, verifySigned, type GiftIntent, type MandateTerms } from "@/lib/mandate-sign";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

const Signed = z.object({ payload: z.record(z.string(), z.unknown()), signature: z.string().min(40).max(200) });
const Input = z.object({ mandate: Signed, gifts: z.array(Signed).max(50).default([]) });

/** Check a signed mandate and its signed gifts. Public: anyone (or any agent) may ask. */
export async function POST(req: Request) {
  return handle(async () => {
    rateLimit(`verify:${req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local"}`, 60, 60_000);
    const i = Input.parse(await req.json());
    const mandateValid = verifySigned(i.mandate.payload, i.mandate.signature) && i.mandate.payload.type === "earmark.mandate";
    const giftsValid = i.gifts.every((g) => verifySigned(g.payload, g.signature) && g.payload.type === "earmark.gift-intent");
    const digest = createHash("sha256").update(canonical(i.mandate.payload)).digest("hex");
    const within = mandateValid && giftsValid ? intentWithinMandate(i.mandate.payload as unknown as MandateTerms, i.gifts.map((g) => g.payload as unknown as GiftIntent), digest) : { ok: false, why: "A signature doesn't match its contents." };
    return { valid: mandateValid && giftsValid && within.ok, mandateValid, giftsValid, withinLimits: within.ok, why: within.why ?? null, digest, gifts: i.gifts.length };
  });
}
