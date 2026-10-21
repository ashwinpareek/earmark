import { handle } from "@/lib/http";
import { getCampaign, HttpError } from "@/lib/store";
import { paypalMode } from "@/lib/paypal";
import { witnessDonation } from "@/lib/witness";

// Ask PayPal (through PayPal's Agent Toolkit) whether it agrees with Earmark's record of a pledge.
// Read-only. Public: it returns statuses and amounts, never emails or names.

export const dynamic = "force-dynamic";

type G = typeof globalThis & { __witnessHits?: Map<string, number[]> };
function limit(ip: string) {
  const g = globalThis as G;
  const hits = (g.__witnessHits ??= new Map());
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t: number) => now - t < 60_000);
  if (list.length >= 30) throw new HttpError(429, "Too many checks. Try again in a minute.");
  list.push(now);
  hits.set(ip, list);
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string; did: string }> }) {
  const { id, did } = await ctx.params;
  return handle(async () => {
    limit(req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local");
    const c = await getCampaign(id);
    const d = c?.donations.find((x) => x.id === did);
    if (!c || !d) throw new HttpError(404, "Pledge not found");
    return witnessDonation(c, d, paypalMode());
  });
}
