import { confirmByOrder } from "@/lib/workflow";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// PayPal sends the donor here after they approve a pledge in PayPal's own window (a pledge started
// from an AI assistant over MCP). PayPal adds ?token=<orderId>. We place the hold and show the receipt.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const c = u.searchParams.get("c") ?? "";
  const token = u.searchParams.get("token") ?? "";
  if (!/^cmp_[a-z0-9]{6,20}$/.test(c) || !/^[A-Z0-9]{10,32}$/.test(token)) return new Response("Bad link", { status: 400 });
  try {
    const next = await confirmByOrder(c, token);
    return Response.redirect(new URL(next, u.origin), 303);
  } catch (e) {
    return Response.redirect(new URL(`/c/${c}?role=donor&pledge_error=${encodeURIComponent((e as Error).message.slice(0, 120))}`, u.origin), 303);
  }
}
