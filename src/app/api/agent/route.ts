import { z } from "zod";
import { handle, rateLimit, sameOrigin } from "@/lib/http";
import { ensureDemoSpace } from "@/lib/space";
import { HttpError, mandateForSpace } from "@/lib/store";
import { catalog, ensureCatalog } from "@/lib/catalog";
import { runGivingAgent } from "@/lib/giving-agent";
import { bindTools, publicMandate } from "@/lib/agent-tools";
import { appBaseUrl } from "@/lib/util";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** The visitor's mandate (if any) and the verified catalog the agent chooses from. */
export async function GET() {
  return handle(async () => {
    const space = await ensureDemoSpace();
    await ensureCatalog();
    const m = await mandateForSpace(space);
    return { mandate: m ? publicMandate(m) : null, catalog: await catalog() };
  });
}

/** Ask the agent to give. It proposes; the mandate rules in code decide; PayPal holds the money. */
export async function POST(req: Request) {
  return handle(async () => {
    sameOrigin(req);
    const { message } = z.object({ message: z.string().min(2).max(600) }).parse(await req.json());
    const space = await ensureDemoSpace();
    rateLimit(`agent:${space}`, 12, 60_000);
    const m = await mandateForSpace(space);
    if (!m) throw new HttpError(400, "Set up your mandate first.");
    const events = await runGivingAgent(message, bindTools(m.id, appBaseUrl()));
    const after = await mandateForSpace(space);
    return { events, mandate: after ? publicMandate(after) : null };
  });
}
