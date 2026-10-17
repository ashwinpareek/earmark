import layout from "./lab-layout.json";
import samples from "./sample-extractions.json";
import type { Extraction } from "./types";

// Forgery Lab: a visitor forges Maya's real estimate in the browser and tries to raise money
// with it. With an AI key, the model reads the forged image like any upload. Without one (or
// if the AI is down), the server can't read pixels, so it applies the visitor's edits to Maya's
// answer key instead — and labels the reading as such. Either way the same rules decide.

export type LabFieldId = (typeof layout.fields)[number]["id"];
export interface LabEdits {
  fields: Partial<Record<string, string>>;
  hidden?: string;
  cropped?: boolean;
}

type SampleMap = Record<string, { file: string; extraction: Extraction }>;
const S = samples as unknown as SampleMap;
const sample = (file: string) => Object.values(S).find((x) => x.file === file)!.extraction;

export const LAB_LAYOUT = layout;

export function parseMoney(s: string): number | null {
  const n = Number(String(s).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) && /\d/.test(s) ? Math.round(n * 100) / 100 : null;
}

function isoDate(s: string): string {
  const t = Date.parse(s.replace(/·/g, " ").trim() + " UTC");
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : "";
}

/** Maya's answer key with the visitor's edits applied (offline reading of a Lab forgery). */
export function applyLabEdits(edits: LabEdits): Extraction {
  const e = structuredClone(edits.cropped ? sample("copycat-estimate.jpg") : sample("maya-estimate.png"));
  const f = edits.fields ?? {};
  for (const [id, raw] of Object.entries(f)) {
    const v = String(raw ?? "").slice(0, 80);
    if (id === "total") e.total = parseMoney(v);
    else if (id.startsWith("line")) {
      const i = Number(id.slice(4));
      if (e.lineItems[i]) e.lineItems[i].amount = parseMoney(v) ?? 0;
    } else if (id === "patientName") e.patientName = v.trim();
    else if (id === "ageDob") {
      const [age, dob] = v.split("·");
      const a = parseInt(age, 10);
      e.patientAge = Number.isFinite(a) ? a : null;
      e.patientDob = dob ? isoDate(dob) : "";
    } else if (id === "documentNumber") e.documentNumber = v.trim();
    else if (id === "documentDate") e.documentDate = isoDate(v);
    else if (id === "providerPhone") e.providerPhone = v.trim();
    else if (id === "providerRegistrationNo") e.providerRegistrationNo = v.trim();
  }
  if (e.lineItems.length && f && Object.keys(f).some((k) => k.startsWith("line"))) {
    e.subtotal = Math.round(e.lineItems.reduce((t, l) => t + l.amount, 0) * 100) / 100;
  }
  if (edits.hidden?.trim()) e.instructionsToReader = edits.hidden.trim().slice(0, 200);
  // Honest about what offline mode can't do: spotting a painted-over number needs the AI reader.
  if (Object.keys(f).length || edits.cropped) e.tamperSignals = ["Offline mode can't inspect pixels; with an AI key the reader looks for mismatched fonts and painted-over values."];
  return e;
}

/** A plain-language list of what the visitor changed, for the Lab's public feed. */
export function describeEdits(edits: LabEdits): string[] {
  const out: string[] = [];
  const label = (id: string) => layout.fields.find((x) => x.id === id)?.label ?? id;
  for (const [id, v] of Object.entries(edits.fields ?? {})) {
    const orig = layout.fields.find((x) => x.id === id)?.value;
    if (v != null && v !== orig) out.push(`${label(id).replace(/ —.*$/, "")} → ${String(v).slice(0, 40)}`);
  }
  if (edits.hidden?.trim()) out.push("hidden note to the AI");
  if (edits.cropped) out.push("cropped and re-saved");
  return out;
}
