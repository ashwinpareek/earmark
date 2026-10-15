import { z } from "zod";
import { handle } from "@/lib/http";
import * as wf from "@/lib/workflow";
import { asRole, viewFor } from "@/lib/views";
import type { Campaign } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("donate_create"), donorName: z.string().max(80), donorEmail: z.string().email(), amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter an amount like 25 or 25.50"), anonymous: z.boolean().default(false), message: z.string().max(280).default("") }),
  z.object({ action: z.literal("donate_confirm"), donationId: z.string(), orderId: z.string() }),
  z.object({ action: z.literal("simulate_donors") }),
  z.object({ action: z.literal("review_campaign"), approve: z.boolean(), note: z.string().max(500).default("") }),
  z.object({ action: z.literal("review_bill"), approve: z.boolean(), note: z.string().max(500).default("") }),
  z.object({ action: z.literal("cancel"), reason: z.string().max(500).default("") }),
  z.object({ action: z.literal("retry_payout") }),
  z.object({ action: z.literal("ask"), question: z.string().min(3).max(500) }),
  z.object({ action: z.literal("respond"), text: z.string().min(10, "Explain in a sentence or two").max(2000) }),
  z.object({ action: z.literal("review_care"), careId: z.string(), approve: z.boolean() }),
]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const role = asRole(new URL(req.url).searchParams.get("role"));
  return handle(async () => {
    const a = Action.parse(await req.json());
    const view = (c: Campaign | undefined) => (c ? viewFor(c, role) : null);
    switch (a.action) {
      case "donate_create": return wf.createDonationOrder(id, a);
      case "donate_confirm": return view(await wf.confirmDonation(id, a.donationId, a.orderId));
      case "simulate_donors": return view(await wf.simulateDonors(id));
      case "review_campaign": return view(await wf.reviewerDecideCampaign(id, a.approve, a.note));
      case "review_bill": return view(await wf.reviewerDecideBill(id, a.approve, a.note));
      case "cancel": return view(await wf.cancelCampaign(id, a.reason));
      case "retry_payout": return view(await wf.retryPayout(id));
      case "ask": return wf.ask(id, a.question);
      case "respond": return view(await wf.organizerRespond(id, a.text));
      case "review_care": return view(await wf.reviewerDecideCare(id, a.careId, a.approve));
    }
  });
}
