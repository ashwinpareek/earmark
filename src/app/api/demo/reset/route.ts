import { cookies } from "next/headers";
import { handle } from "@/lib/http";
import { deleteSpace } from "@/lib/store";
import { demoSpace, SPACE_COOKIE } from "@/lib/space";
export const dynamic = "force-dynamic";
// Wipes this visitor's demo campaigns so the next run starts fresh. Real campaigns are untouched.
export async function POST() {
  return handle(async () => {
    const s = await demoSpace();
    const removed = s ? await deleteSpace(s) : 0;
    (await cookies()).delete(SPACE_COOKIE);
    return { removed };
  });
}
