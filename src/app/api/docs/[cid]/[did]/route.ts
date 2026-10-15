import { getCampaign } from "@/lib/store";
import { readFile } from "@/lib/files";
import { asRole } from "@/lib/views";

export const dynamic = "force-dynamic";

// Raw documents are never public. Demo: the role comes from the query string.
export async function GET(req: Request, ctx: { params: Promise<{ cid: string; did: string }> }) {
  const { cid, did } = await ctx.params;
  if (asRole(new URL(req.url).searchParams.get("role")) === "donor") return new Response("Documents are private", { status: 403 });
  const c = await getCampaign(cid);
  const d = c?.docs.find((x) => x.id === did);
  if (!d) return new Response("Not found", { status: 404 });
  const buf = await readFile(d.sha256, d.mime);
  return new Response(new Uint8Array(buf), { headers: { "content-type": d.mime, "cache-control": "private, max-age=300" } });
}
