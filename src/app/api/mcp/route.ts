import { z } from "zod";
import { handleRpc, type Json, type ToolDef } from "@/lib/mcp";
import { searchCatalog, campaignEvidence } from "@/lib/agent-tools";
import { CATALOG_SPACE, ensureCatalog } from "@/lib/catalog";
import { createDonationOrder } from "@/lib/workflow";
import { getCampaign } from "@/lib/store";
import { witnessDonation } from "@/lib/witness";
import { paypalMode } from "@/lib/paypal";
import { appBaseUrl } from "@/lib/util";
import { rateLimit } from "@/lib/http";
import { canonical, intentWithinMandate, publicKey, verifySigned, type GiftIntent, type MandateTerms } from "@/lib/mandate-sign";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const base = () => appBaseUrl();

const TOOLS: ToolDef[] = [
  {
    name: "find_verified_campaigns",
    title: "Find verified campaigns",
    description: "Live Earmark campaigns whose hospital documents were checked and confirmed. Optionally filter by what the donor cares about (e.g. 'children's surgery', 'burns').",
    inputSchema: { type: "object", properties: { query: { type: "string", description: "What the donor cares about" } } },
    annotations: { readOnlyHint: true },
    async run(a) {
      await ensureCatalog();
      const list = await searchCatalog(String(a.query ?? ""), base());
      return { campaigns: list.map((c) => ({ campaign_id: c.id, patient: c.patient, age: c.age, hospital: `${c.hospital}, ${c.city}`, procedure: c.procedure, diagnosis: c.diagnosis, goal_usd: c.goal, held_usd: c.held, still_needs_usd: c.stillNeeds, checks: `${c.checksPassed}/${c.checksTotal} passed, ${c.checksFailed} failed`, url: c.url })) };
    },
  },
  {
    name: "get_campaign_evidence",
    title: "Read a campaign's evidence",
    description: "Every verification check for one campaign (hospital registry, arithmetic, same patient, reuse, editing, hidden instructions, hospital confirmation) with its evidence, plus the verified facts.",
    inputSchema: { type: "object", properties: { campaign_id: { type: "string" } }, required: ["campaign_id"] },
    annotations: { readOnlyHint: true },
    run: (a) => campaignEvidence(String(a.campaign_id ?? "")),
  },
  {
    name: "create_pledge",
    title: "Start a pledge (donor approves in PayPal)",
    description: "Create a PayPal hold for a verified campaign. Returns a PayPal link the donor must open and approve themselves; nothing is charged until the hospital's bill is verified, and only the donor's fair share is ever collected. Show the donor the link.",
    inputSchema: { type: "object", properties: { campaign_id: { type: "string" }, amount_usd: { type: "number", minimum: 1 }, donor_name: { type: "string" }, donor_email: { type: "string" } }, required: ["campaign_id", "amount_usd", "donor_email"] },
    async run(a) {
      const i = z.object({ campaign_id: z.string().max(64), amount_usd: z.number().min(1).max(5000), donor_name: z.string().max(80).default("A friend"), donor_email: z.string().email() }).parse(a);
      const c = await getCampaign(i.campaign_id);
      if (!c || (c.space ?? "main") !== CATALOG_SPACE) throw new Error("Not a public, verified campaign.");
      const o = await createDonationOrder(c.id, { donorName: i.donor_name, donorEmail: i.donor_email, amount: i.amount_usd.toFixed(2), anonymous: false, message: "", surplus: "release", returnPath: `/api/pledge/return?c=${c.id}` });
      return {
        approve_url: o.approveUrl ?? (paypalMode() === "mock" ? `${base()}/api/pledge/return?c=${c.id}&token=${o.orderId}` : null),
        paypal_order_id: o.orderId,
        donation_id: o.donationId,
        what_happens: `Open approve_url to approve a $${i.amount_usd.toFixed(2)} hold for ${c.patient.displayName} in PayPal. Nothing is charged now. When the hospital's final bill is verified, you pay your fair share, straight to the hospital; the rest is released.`,
      };
    },
  },
  {
    name: "check_receipt_with_paypal",
    title: "Check a gift against PayPal",
    description: "Compare Earmark's record of one gift with PayPal's own records, read through PayPal's Agent Toolkit (read-only get_order): the hold, what was collected, and whether the rest was released.",
    inputSchema: { type: "object", properties: { campaign_id: { type: "string" }, donation_id: { type: "string" } }, required: ["campaign_id", "donation_id"] },
    annotations: { readOnlyHint: true },
    async run(a) {
      const c = await getCampaign(String(a.campaign_id ?? ""));
      const d = c?.donations.find((x) => x.id === String(a.donation_id ?? ""));
      if (!c || !d) throw new Error("Gift not found.");
      if ((c.space ?? "main") !== CATALOG_SPACE) throw new Error("Only public campaigns can be checked here.");
      return witnessDonation(c, d, paypalMode() === "mock" ? "mock" : "sandbox");
    },
  },
  {
    name: "verify_signed_mandate",
    title: "Verify a signed mandate and its gifts",
    description: "Check an Earmark Giving Agent mandate: that the donor's limits carry Earmark's Ed25519 signature, that each gift's signed intent names that exact mandate, and that the gifts stay inside its per-gift and total limits. Pass the objects from Earmark's /api/agent/proof. Call with no arguments to get the public key.",
    inputSchema: { type: "object", properties: { mandate: { type: "object", properties: { payload: { type: "object" }, signature: { type: "string" } } }, gifts: { type: "array", items: { type: "object", properties: { payload: { type: "object" }, signature: { type: "string" } } } } } },
    annotations: { readOnlyHint: true },
    async run(a) {
      const md = a.mandate as { payload?: Record<string, unknown>; signature?: string } | undefined;
      if (!md?.payload || !md.signature) return { key: publicKey() };
      const gifts = (Array.isArray(a.gifts) ? a.gifts : []).slice(0, 50) as { payload: Record<string, unknown>; signature: string }[];
      const mandateValid = md.payload.type === "earmark.mandate" && verifySigned(md.payload, md.signature);
      const giftsValid = gifts.every((g) => g?.payload?.type === "earmark.gift-intent" && verifySigned(g.payload, String(g.signature ?? "")));
      const digest = createHash("sha256").update(canonical(md.payload)).digest("hex");
      const within = mandateValid && giftsValid ? intentWithinMandate(md.payload as unknown as MandateTerms, gifts.map((g) => g.payload as unknown as GiftIntent), digest) : { ok: false, why: "A signature doesn't match its contents." };
      return { valid: mandateValid && giftsValid && within.ok, mandateValid, giftsValid, withinLimits: within.ok, why: within.why ?? null, digest, gifts: gifts.length };
    },
  },
];

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type, mcp-protocol-version, mcp-session-id, authorization" };

export async function OPTIONS() { return new Response(null, { status: 204, headers: CORS }); }

export async function GET() {
  return new Response(JSON.stringify({ name: "earmark", transport: "streamable-http", endpoint: "/api/mcp", tools: TOOLS.map((t) => t.name) }), { status: 405, headers: { ...CORS, "content-type": "application/json", allow: "POST" } });
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  try { rateLimit(`mcp:${ip}`, 60, 60_000); } catch { return new Response(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Rate limited" } }), { status: 429, headers: { ...CORS, "content-type": "application/json" } }); }
  let body: unknown;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }), { status: 400, headers: { ...CORS, "content-type": "application/json" } }); }
  const msgs = (Array.isArray(body) ? body : [body]) as Json[];
  const out = (await Promise.all(msgs.map((m) => handleRpc(m as never, TOOLS)))).filter(Boolean);
  if (!out.length) return new Response(null, { status: 202, headers: CORS });
  return new Response(JSON.stringify(Array.isArray(body) ? out : out[0]), { status: 200, headers: { ...CORS, "content-type": "application/json" } });
}
