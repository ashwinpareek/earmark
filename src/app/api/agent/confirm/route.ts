import { z } from "zod";
import { handle, sameOrigin } from "@/lib/http";
import { ensureDemoSpace } from "@/lib/space";
import { HttpError, mandateForSpace } from "@/lib/store";
import { confirmMandateGift } from "@/lib/workflow";
import { publicMandate } from "@/lib/mandate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  return handle(async () => {
    sameOrigin(req);
    const b = z.object({ campaignId: z.string().max(64), donationId: z.string().max(64), orderId: z.string().max(64), reason: z.string().max(300).default("") }).parse(await req.json());
    const space = await ensureDemoSpace();
    const m = await mandateForSpace(space);
    if (!m) throw new HttpError(400, "Set up your mandate first.");
    const r = await confirmMandateGift(m.id, b.campaignId, b.donationId, b.orderId, b.reason);
    return { activated: r.activated, mandate: publicMandate((await mandateForSpace(space))!) };
  });
}
