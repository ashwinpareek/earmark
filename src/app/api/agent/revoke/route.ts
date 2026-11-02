import { handle, sameOrigin } from "@/lib/http";
import { ensureDemoSpace } from "@/lib/space";
import { HttpError, mandateForSpace } from "@/lib/store";
import { revokeMandate } from "@/lib/workflow";

export const dynamic = "force-dynamic";

/** Stop the agent: the mandate is revoked and the saved PayPal token is deleted at PayPal. */
export async function POST(req: Request) {
  return handle(async () => {
    sameOrigin(req);
    const m = await mandateForSpace(await ensureDemoSpace());
    if (!m) throw new HttpError(404, "No mandate");
    return revokeMandate(m.id);
  });
}
