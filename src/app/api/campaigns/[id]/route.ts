import { handle } from "@/lib/http";
import { getCampaign, HttpError } from "@/lib/store";
import { asRole, viewFor } from "@/lib/views";
import { nextPatientFor } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    const c = await getCampaign(id);
    if (!c) throw new HttpError(404, "Campaign not found");
    // "next": another verified patient, shown when this campaign can't take more pledges.
    return { ...viewFor(c, asRole(new URL(req.url).searchParams.get("role"))), next: await nextPatientFor(c) };
  });
}
