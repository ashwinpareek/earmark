import { handle } from "@/lib/http";
import { getCampaign, HttpError } from "@/lib/store";
import { getPayoutBatch, paypalMode } from "@/lib/paypal";
import { provider } from "@/lib/providers";
import { witnessDonation, withPayoutCheck } from "@/lib/witness";

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
    const w = await witnessDonation(c, d, paypalMode());
    // Payout mode: the hospital is paid by a separate Payouts batch, so read that too.
    const s = c.settlement;
    const hosp = provider(c.providerId)?.name ?? "the hospital";
    const mine = s?.payees?.find((p) => p.name === hosp);
    if (!s || s.direct || !s.payoutBatchId || !mine || d.status !== "captured") return w;
    try {
      const b = await getPayoutBatch(s.payoutBatchId);
      const item = b.items.find((i) => i.ref === `${c.id}-bill`);
      const st = item?.status ?? b.status;
      const ok = ["SUCCESS", "COMPLETED", "PENDING", "PROCESSING"].includes(st.toUpperCase());
      return withPayoutCheck(w, { earmark: `$${mine.amount} to ${hosp}`, paypal: `batch ${s.payoutBatchId}: ${st}`, ok });
    } catch {
      return withPayoutCheck(w, { earmark: `$${mine.amount} to ${hosp}`, paypal: "couldn't be read right now", ok: false });
    }
  });
}
