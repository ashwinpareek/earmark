import { handle } from "@/lib/http";
import { ensureDemoSpace } from "@/lib/space";
import { mandateForSpace } from "@/lib/store";
import { mandateProof } from "@/lib/mandate-sign";

export const dynamic = "force-dynamic";

/** The visitor's signed mandate and one signed intent per gift (see mandate-sign.ts). */
export async function GET() {
  return handle(async () => {
    const m = await mandateForSpace(await ensureDemoSpace());
    return m ? mandateProof(m) : { mandate: null, gifts: [] };
  });
}
