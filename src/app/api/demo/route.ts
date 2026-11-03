import { viewFor } from "@/lib/views";
import { z } from "zod";
import { handle, sameOrigin } from "@/lib/http";
import { listCampaigns } from "@/lib/workflow";
import { honest, ensureAarav, fraud, copycat } from "@/lib/scenarios";
import { ensureDemoSpace } from "@/lib/space";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  return handle(async () => {
    sameOrigin(req);
    const { scenario } = z.object({ scenario: z.enum(["honest", "fraud", "copycat"]) }).parse(await req.json());
    // Every visitor gets a private demo space, so judges never collide with each other.
    const space = await ensureDemoSpace();
    if (scenario === "honest") {
      // One genuine Maya per space: reopen it instead of making a "copy" that would be flagged.
      const existing = (await listCampaigns([space])).find((c) => c.docs.some((d) => d.filename === "maya-estimate.png"));
      const maya = existing ?? (await honest(space));
      // Aarav (the next verified patient, for "Pass it on") is prepared in the background,
      // so opening Maya's campaign never waits on reading his documents.
      void ensureAarav(space).catch(() => undefined);
      return viewFor(maya, "organizer");
    }
    return viewFor(scenario === "fraud" ? await fraud(space) : await copycat(space), "organizer");
  });
}
