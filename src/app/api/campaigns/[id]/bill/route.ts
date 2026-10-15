import { handle } from "@/lib/http";
import { HttpError } from "@/lib/store";
import { submitFinalBill } from "@/lib/workflow";
import { viewFor } from "@/lib/views";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    const f = (await req.formData()).get("bill");
    if (!(f instanceof File) || f.size === 0) throw new HttpError(400, "Attach the final bill");
    return viewFor(await submitFinalBill(id, { filename: f.name, buf: Buffer.from(await f.arrayBuffer()) }), "hospital");
  });
}
