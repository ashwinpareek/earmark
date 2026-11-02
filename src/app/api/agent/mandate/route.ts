import { z } from "zod";
import { handle, sameOrigin } from "@/lib/http";
import { ensureDemoSpace } from "@/lib/space";
import { mandateForSpace, saveMandate, updateMandate } from "@/lib/store";
import { publicMandate, type Mandate } from "@/lib/mandate";
import { nowIso, uid } from "@/lib/util";

export const dynamic = "force-dynamic";

const Input = z.object({
  donorName: z.string().trim().min(1, "Add your name").max(80),
  donorEmail: z.string().trim().email("Add an email for receipts"),
  limit: z.number().min(5).max(2000),
  perGift: z.number().min(5).max(1000),
  cause: z.string().trim().min(2, "Say what you care about").max(200),
});

/** Create or update the donor's mandate. Limits can change; a mandate with PayPal stays active. */
export async function POST(req: Request) {
  return handle(async () => {
    sameOrigin(req);
    const i = Input.parse(await req.json());
    const space = await ensureDemoSpace();
    const existing = await mandateForSpace(space);
    const perGift = Math.min(i.perGift, i.limit);
    if (existing) {
      await updateMandate(existing.id, (m) => { m.donorName = i.donorName; m.donorEmail = i.donorEmail; m.limitCents = Math.round(i.limit * 100); m.perGiftCents = Math.round(perGift * 100); m.cause = i.cause; });
      return publicMandate((await mandateForSpace(space))!);
    }
    const m: Mandate = { id: uid("mdt"), space, donorName: i.donorName, donorEmail: i.donorEmail, limitCents: Math.round(i.limit * 100), perGiftCents: Math.round(perGift * 100), cause: i.cause, status: "draft", gifts: [], createdAt: nowIso() };
    await saveMandate(m);
    return publicMandate(m);
  });
}
