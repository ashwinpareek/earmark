import { handle } from "@/lib/http";
import { publicKey } from "@/lib/mandate-sign";

export const dynamic = "force-dynamic";

/** Earmark's public key for mandate and gift-intent signatures. */
export async function GET() {
  return handle(async () => publicKey());
}
