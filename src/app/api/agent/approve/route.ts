import { z } from "zod";
import { handle, sameOrigin } from "@/lib/http";
import { ensureDemoSpace } from "@/lib/space";
import { getCampaign, HttpError, mandateForSpace } from "@/lib/store";
import { candidateOf, createDonationOrder } from "@/lib/workflow";
import { checkGift } from "@/lib/mandate";
import { CATALOG_SPACE } from "@/lib/catalog";
import { toCents } from "@/lib/util";

export const dynamic = "force-dynamic";

/** The agent's first proposed gift becomes a PayPal order that also saves the donor's PayPal. */
export async function POST(req: Request) {
  return handle(async () => {
    sameOrigin(req);
    const { campaignId, amount } = z.object({ campaignId: z.string().max(64), amount: z.string().regex(/^\d+(\.\d{1,2})?$/) }).parse(await req.json());
    const space = await ensureDemoSpace();
    const m = await mandateForSpace(space);
    if (!m) throw new HttpError(400, "Set up your mandate first.");
    const c = await getCampaign(campaignId);
    if (!c || (c.space ?? "main") !== CATALOG_SPACE) throw new HttpError(404, "Not a catalog campaign");
    const stillNeeds = Math.max(0, toCents(c.goal) - c.donations.filter((d) => d.status === "held").reduce((s, d) => s + toCents(d.pledged), 0));
    const v = checkGift(m, candidateOf(c, stillNeeds), toCents(amount), { requireActive: false });
    if (!v.ok) throw new HttpError(409, v.why);
    return createDonationOrder(campaignId, { donorName: m.donorName, donorEmail: m.donorEmail, amount, anonymous: false, message: "", surplus: "release", vault: true });
  });
}
