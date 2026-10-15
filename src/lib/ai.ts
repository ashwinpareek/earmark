// Provider-agnostic multimodal LLM client that always returns parsed JSON.
// Anthropic, OpenAI and Google Gemini via plain fetch. Attachments (images, PDFs) are sent
// natively to each provider. With no key configured the app falls back to a clearly
// labelled offline mode (see reader.ts) so it still runs end-to-end for local development.

export type Provider = "anthropic" | "openai" | "gemini" | "offline";

export interface Attachment {
  mime: string; // image/png | image/jpeg | image/webp | application/pdf
  data: string; // base64
  filename: string;
}

export function aiProvider(): Provider {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "offline";
}

export function aiModelName(): string {
  switch (aiProvider()) {
    case "anthropic":
      return process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
    case "openai":
      return process.env.OPENAI_MODEL || "gpt-4o-mini";
    case "gemini":
      return process.env.GEMINI_MODEL || "gemini-2.5-flash";
    default:
      return "offline";
  }
}

export class AIError extends Error {}

const JSON_ONLY = "\n\nRespond with a single JSON object only. No markdown fences, no prose.";

export async function llmJson<T>(
  system: string,
  user: string,
  opts: { maxTokens?: number; attachments?: Attachment[]; temperature?: number } = {},
): Promise<T> {
  const provider = aiProvider();
  const model = aiModelName();
  const maxTokens = opts.maxTokens ?? 4000;
  const atts = opts.attachments ?? [];
  let text: string;

  if (provider === "anthropic") {
    const content: unknown[] = atts.map((a) =>
      a.mime === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: a.mime, data: a.data } }
        : { type: "image", source: { type: "base64", media_type: a.mime, data: a.data } },
    );
    content.push({ type: "text", text: user });
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: maxTokens, system: system + JSON_ONLY, messages: [{ role: "user", content }] }),
    });
    if (!res.ok) throw new AIError(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const j = (await res.json()) as { content: { type: string; text?: string }[] };
    text = j.content.filter((c) => c.type === "text").map((c) => c.text).join("");
  } else if (provider === "openai") {
    const content: unknown[] = [{ type: "text", text: user }];
    for (const a of atts) {
      content.push(
        a.mime === "application/pdf"
          ? { type: "file", file: { filename: a.filename, file_data: `data:${a.mime};base64,${a.data}` } }
          : { type: "image_url", image_url: { url: `data:${a.mime};base64,${a.data}`, detail: "high" } },
      );
    }
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system + JSON_ONLY },
          { role: "user", content },
        ],
      }),
    });
    if (!res.ok) throw new AIError(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const j = (await res.json()) as { choices: { message: { content: string } }[] };
    text = j.choices[0]?.message?.content ?? "";
  } else if (provider === "gemini") {
    const parts: unknown[] = atts.map((a) => ({ inline_data: { mime_type: a.mime, data: a.data } }));
    parts.push({ text: user });
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: maxTokens, temperature: opts.temperature ?? 0.1 },
        }),
      },
    );
    if (!res.ok) throw new AIError(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  } else {
    throw new AIError("offline");
  }
  return parseJsonLoose<T>(text);
}

export function parseJsonLoose<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const s = cleaned.indexOf("{");
    const e = cleaned.lastIndexOf("}");
    if (s >= 0 && e > s) return JSON.parse(cleaned.slice(s, e + 1)) as T;
    throw new AIError("Model did not return valid JSON");
  }
}
