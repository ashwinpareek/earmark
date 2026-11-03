import { handle } from "@/lib/http";
import { visibleSpaces } from "@/lib/space";
import { ledgerData } from "@/lib/ledger";

export const dynamic = "force-dynamic";

// Public transparency data for the AG Studio ledger. No donor emails, no patient full names.
export async function GET() {
  return handle(async () => ledgerData(await visibleSpaces()));
}
