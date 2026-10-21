import { z } from "zod";
import { handle, sameOrigin } from "@/lib/http";
import { HttpError } from "@/lib/store";
import { aiModelName, aiProvider } from "@/lib/ai";

// Server half of the ledger assistant ("Ask the ledger"). AG Studio's agents run in the browser
// and call this once per turn with the conversation, instructions and tool schemas. We forward the
// turn to the configured model with the API key kept server-side and return the output items.
// Studio executes the tools in the browser; they only change the dashboard view (filters, widgets,
// pages). Nothing here can touch a campaign, a PayPal hold or a payout.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Item = z.object({ type: z.string() }).passthrough();
const Body = z.object({
  instructions: z.string().max(200_000).optional(),
  input: z.array(Item).max(400),
  tools: z.array(z.object({ name: z.string(), description: z.string().default(""), parameters: z.any() })).max(120).default([]),
  toolChoice: z.any().optional(),
  responseFormat: z.object({ type: z.enum(["text", "json"]), name: z.string().optional(), schema: z.any().optional() }).default({ type: "text" }),
});

const EARMARK_NOTES = `

About this dashboard: it is Earmark's public transparency ledger for medical fundraising. Donations are PayPal holds; when a hospital's bill is verified, each hold is partially captured for a fair share and the rest is never charged; money is paid only to verified hospitals and pharmacies, never to families. You can explain, filter, chart and summarise the ledger. You cannot change campaigns or move money, and you must never claim to. When you state a number, say which table it comes from.`;

// Simple per-IP limiter so the endpoint can't be used as a free LLM proxy.
type G = typeof globalThis & { __emAiHits?: Map<string, number[]> };
const g = globalThis as G;
function limit(ip: string) {
  const hits = (g.__emAiHits ??= new Map());
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t: number) => now - t < 10 * 60_000);
  if (list.length >= 60) throw new HttpError(429, "The ledger assistant is busy. Try again in a few minutes.");
  list.push(now);
  hits.set(ip, list);
}

type Out =
  | { id: string; kind: "output"; type: "message"; role: "assistant"; status: "completed"; content: { type: "text"; text: string; annotations: [] }[] }
  | { id: string; kind: "output"; type: "function_call"; callId: string; name: string; arguments: string; status: "completed" };

const rid = () => Math.random().toString(36).slice(2, 12);

export async function POST(req: Request) {
  return handle(async () => {
    sameOrigin(req);
    limit(req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local");
    const raw = await req.text();
    if (raw.length > 1_500_000) throw new HttpError(413, "Turn too large");
    const body = Body.parse(JSON.parse(raw));
    const provider = aiProvider();
    const instructions = (body.instructions ?? "") + EARMARK_NOTES;
    let output: Out[];
    if (process.env.LEDGER_AI_FAKE === "1") {
      // Development only: proves the Studio ⇄ server protocol without spending tokens.
      const items = body.input as AnyItem[];
      const lastItem = items[items.length - 1];
      const last = [...items].reverse().find((i) => i.type === "message" && i.role === "user");
      const text = (t: string): Out => ({ id: `msg_${rid()}`, kind: "output", type: "message", role: "assistant", status: "completed", content: [{ type: "text", text: t, annotations: [] }] });
      if (lastItem?.type === "function_call_output") output = [text(`(fake model) The tool returned: ${String(lastItem.output).slice(0, 400)}`)];
      else if (body.tools.some((t) => t.name === "open_case_file") && last && /case file/i.test(textOf(last))) output = [{ id: `fc_${rid()}`, kind: "output", type: "function_call", callId: `call_${rid()}`, name: "open_case_file", arguments: JSON.stringify({ campaign: "Leo" }), status: "completed" }];
      else output = [text(`(fake model) You asked: "${last ? textOf(last).slice(0, 120) : ""}". Studio offered me ${body.tools.length} tools: ${body.tools.slice(0, 6).map((t) => t.name).join(", ")}…`)];
    } else if (provider === "gemini") output = await gemini(body, instructions);
    else if (provider === "openai") output = await openai(body, instructions);
    else throw new HttpError(503, provider === "offline" ? "The ledger assistant needs an AI key (GEMINI_API_KEY or OPENAI_API_KEY)." : "The ledger assistant supports Gemini or OpenAI keys.");
    return { id: `resp_${rid()}`, createdAt: Date.now(), status: "completed", model: aiModelName(), output };
  });
}

type B = z.infer<typeof Body>;
type AnyItem = Record<string, unknown> & { type: string };

function textOf(it: AnyItem): string {
  const c = it.content as { type: string; text?: string; refusal?: string }[] | undefined;
  return (c ?? []).map((p) => p.text ?? p.refusal ?? "").join("");
}

// ─── Gemini ───────────────────────────────────────────────────────────────

async function gemini(body: B, instructions: string): Promise<Out[]> {
  const items = body.input as AnyItem[];
  const nameOf = new Map(items.filter((i) => i.type === "function_call").map((i) => [String(i.callId), String(i.name)]));
  const contents: { role: "user" | "model"; parts: unknown[] }[] = [];
  const push = (role: "user" | "model", part: unknown) => {
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts.push(part);
    else contents.push({ role, parts: [part] });
  };
  let system = instructions;
  for (const it of items) {
    if (it.type === "message" && it.role === "system") system += `\n\n${textOf(it)}`;
    else if (it.type === "message" && it.role === "user") push("user", { text: textOf(it) || " " });
    else if (it.type === "message" && it.role === "assistant") push("model", { text: textOf(it) || " " });
    else if (it.type === "function_call") push("model", { functionCall: { name: it.name, args: safeJson(String(it.arguments ?? "{}")) } });
    else if (it.type === "function_call_output") push("user", { functionResponse: { name: nameOf.get(String(it.callId)) ?? "tool", response: { result: String(it.output ?? "") } } });
  }
  if (!contents.length) contents.push({ role: "user", parts: [{ text: " " }] });
  const tc = body.toolChoice;
  const mode = tc === "none" ? "NONE" : tc === "required" || (tc && typeof tc === "object") ? "ANY" : "AUTO";
  const useTools = body.tools.length > 0 && mode !== "NONE";
  const json = body.responseFormat.type === "json" && !useTools;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${aiModelName()}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    signal: AbortSignal.timeout(55_000),
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      ...(useTools && {
        tools: [{ functionDeclarations: body.tools.map((t) => ({ name: t.name, description: t.description.slice(0, 4000), parametersJsonSchema: t.parameters ?? { type: "object", properties: {} } })) }],
        toolConfig: { functionCallingConfig: { mode, ...(tc && typeof tc === "object" && tc.name ? { allowedFunctionNames: [tc.name] } : {}) } },
      }),
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096, ...(json && { responseMimeType: "application/json", ...(body.responseFormat.schema && { responseJsonSchema: body.responseFormat.schema }) }) },
    }),
  });
  if (!res.ok) throw new HttpError(502, `Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean; functionCall?: { id?: string; name: string; args?: unknown } }[] } }[] };
  const parts = j.candidates?.[0]?.content?.parts ?? [];
  const out: Out[] = [];
  const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("");
  if (text) out.push({ id: `msg_${rid()}`, kind: "output", type: "message", role: "assistant", status: "completed", content: [{ type: "text", text, annotations: [] }] });
  for (const p of parts) {
    if (!p.functionCall) continue;
    const callId = p.functionCall.id || `call_${rid()}`;
    out.push({ id: `fc_${rid()}`, kind: "output", type: "function_call", callId, name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args ?? {}), status: "completed" });
  }
  if (!out.length) out.push({ id: `msg_${rid()}`, kind: "output", type: "message", role: "assistant", status: "completed", content: [{ type: "text", text: "I couldn't produce an answer for that. Try rephrasing.", annotations: [] }] });
  return out;
}

// ─── OpenAI ───────────────────────────────────────────────────────────────

async function openai(body: B, instructions: string): Promise<Out[]> {
  const messages: unknown[] = [{ role: "system", content: instructions }];
  for (const it of body.input as AnyItem[]) {
    if (it.type === "message") messages.push({ role: it.role === "assistant" ? "assistant" : it.role === "system" ? "system" : "user", content: textOf(it) });
    else if (it.type === "function_call") messages.push({ role: "assistant", content: null, tool_calls: [{ id: it.callId, type: "function", function: { name: it.name, arguments: it.arguments } }] });
    else if (it.type === "function_call_output") messages.push({ role: "tool", tool_call_id: it.callId, content: String(it.output ?? "") });
  }
  const tc = body.toolChoice;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(55_000),
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: aiModelName(),
      messages,
      ...(body.tools.length && {
        tools: body.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })),
        tool_choice: tc && typeof tc === "object" ? { type: "function", function: { name: tc.name } } : tc ?? "auto",
      }),
      ...(body.responseFormat.type === "json" && !body.tools.length && { response_format: { type: "json_object" } }),
    }),
  });
  if (!res.ok) throw new HttpError(502, `OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as { choices: { message: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[] };
  const m = j.choices[0]?.message ?? {};
  const out: Out[] = [];
  if (m.content) out.push({ id: `msg_${rid()}`, kind: "output", type: "message", role: "assistant", status: "completed", content: [{ type: "text", text: m.content, annotations: [] }] });
  for (const c of m.tool_calls ?? []) out.push({ id: `fc_${rid()}`, kind: "output", type: "function_call", callId: c.id, name: c.function.name, arguments: c.function.arguments, status: "completed" });
  return out;
}

function safeJson(s: string) {
  try { return JSON.parse(s); } catch { return {}; }
}
