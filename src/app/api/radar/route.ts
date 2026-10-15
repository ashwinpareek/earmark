import { handle } from "@/lib/http";
import { reuseRadar } from "@/lib/workflow";
import { demoSpace } from "@/lib/space";
export const dynamic = "force-dynamic";
// The radar shows the visitor's own demo space if they have one, otherwise real campaigns.
export async function GET() {
  return handle(async () => {
    const space = (await demoSpace()) ?? "main";
    return { space: space === "main" ? "main" : "demo", items: await reuseRadar(space) };
  });
}
