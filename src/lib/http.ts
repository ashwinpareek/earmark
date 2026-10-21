import { NextResponse } from "next/server";
import { HttpError } from "./store";
import { AIError, PayPalError } from "./errors";
import { ZodError } from "zod";

export async function handle<T>(fn: () => Promise<T>) {
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof PayPalError)
      return NextResponse.json({ error: e.message, issue: e.issue, debugId: e.debugId }, { status: e.status >= 400 && e.status < 600 ? e.status : 502 });
    if (e instanceof AIError) return NextResponse.json({ error: e.message }, { status: 502 });
    if (e instanceof ZodError) return NextResponse.json({ error: "Invalid input", details: e.issues }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: (e as Error).message || "Server error" }, { status: 500 });
  }
}

/** CSRF guard for state-changing routes: browsers send Origin on cross-site POSTs, and a pledge,
 *  an upload or a review decision may only come from Earmark's own pages. Server-to-server
 *  callers (PayPal webhooks, the cron job) don't use these routes. */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let o = "";
  try { o = new URL(origin).host; } catch { /* "null" or junk */ }
  if (!host || o !== host) throw new HttpError(403, "Cross-site request refused.");
}
