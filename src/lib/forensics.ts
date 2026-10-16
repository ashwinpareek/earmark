import type { Check, Doc, Extraction, Provider, VerificationReport } from "./types";
import { normDigits, sameProviderName } from "./providers";

// FORENSIC RULES — deterministic, unit-tested checks over what the Document Reader extracted.
// The model reads; these rules decide. Every check carries concrete evidence so a donor,
// an organizer or a reviewer can see exactly why a campaign passed or failed.

export interface PriorDoc {
  campaignId: string;
  docId: string;
  sha256: string;
  fingerprint: string; // provider|documentNumber
  phash?: string; // visual fingerprint
  patientKey: string;
  campaignLabel: string; // e.g. "Help Maya recover… (Maya R.)"
}

import { looksAlike, visualSimilarity } from "./phash";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export const patientKey = (name: string) => norm(name);
export const fingerprintOf = (e: Extraction) =>
  e.documentNumber ? `${norm(e.providerName)}|${norm(e.documentNumber)}` : "";

const usd = (n: number, cur = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: cur || "USD" }).format(n);
const round2 = (n: number) => Math.round(n * 100) / 100;

export function ageFromDob(dob: string, on: Date): number | null {
  const m = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = on.getUTCFullYear() - y;
  if (on.getUTCMonth() + 1 < mo || (on.getUTCMonth() + 1 === mo && on.getUTCDate() < d)) age--;
  return age;
}

/** Arithmetic: do the printed line items explain the printed total? Accepts either
 *  "lines are patient amounts" or "lines are gross, minus insurer" layouts. */
export function arithmeticCheck(e: Extraction, docId: string): Check {
  const lineSum = round2(e.lineItems.reduce((s, l) => s + (Number.isFinite(l.amount) ? l.amount : 0), 0));
  const total = e.total;
  if (total == null || !e.lineItems.length) {
    return { id: "arithmetic", label: "Totals add up", status: "warn", detail: "No itemised amounts or no total could be read, so the arithmetic could not be checked.", docIds: [docId], source: "rule" };
  }
  const adj = (e.tax ?? 0) - (e.discount ?? 0);
  const candidates = [lineSum + adj, lineSum + adj - (e.insuranceCovered ?? 0)];
  const tol = Math.max(1, total * 0.005);
  const ok = candidates.some((c) => Math.abs(round2(c) - total) <= tol);
  if (ok) {
    return { id: "arithmetic", label: "Totals add up", status: "pass", detail: `${e.lineItems.length} line items add up to the printed total of ${usd(total, e.currency)}.`, docIds: [docId], source: "rule" };
  }
  const diff = round2(total - (lineSum + adj));
  return {
    id: "arithmetic",
    label: "Totals add up",
    status: "fail",
    detail: `The line items add up to ${usd(lineSum + adj, e.currency)}, but the printed total is ${usd(total, e.currency)} (${diff > 0 ? "+" : ""}${usd(diff, e.currency)}).`,
    docIds: [docId],
    source: "rule",
  };
}

export function providerChecks(e: Extraction, p: Provider, docId: string, what = "estimate"): Check[] {
  const checks: Check[] = [];
  const nameOk = sameProviderName(e.providerName, p.name);
  checks.push({
    id: "provider_match",
    label: "Issued by the chosen hospital",
    status: nameOk ? "pass" : "fail",
    detail: nameOk
      ? `The ${what} is issued by ${p.name}, a verified hospital since ${p.verifiedSince}.`
      : `The ${what} names “${e.providerName || "no hospital"}”, not ${p.name}.`,
    docIds: [docId],
    source: "rule",
  });
  const phoneOk = !e.providerPhone || normDigits(e.providerPhone) === normDigits(p.phone);
  const regOk = !e.providerRegistrationNo || norm(e.providerRegistrationNo) === norm(p.registrationNo);
  const misses: string[] = [];
  if (!phoneOk) misses.push(`phone ${e.providerPhone} (registry: ${p.phone})`);
  if (!regOk) misses.push(`licence ${e.providerRegistrationNo} (registry: ${p.registrationNo})`);
  checks.push({
    id: "provider_contact",
    label: "Hospital details match the registry",
    status: misses.length === 0 ? "pass" : misses.length === 1 ? "warn" : "fail",
    detail: misses.length === 0 ? "Phone number and licence number match the hospital's registry entry." : `Doesn't match the registry: ${misses.join("; ")}.`,
    docIds: [docId],
    source: "rule",
  });
  return checks;
}

export function identityCheck(docs: Doc[], on: Date): Check {
  const withName = docs.filter((d) => d.extraction?.patientName);
  if (withName.length < 2) {
    return { id: "identity", label: "Same patient on every document", status: "warn", detail: "Only one document names the patient, so identity could not be cross-checked. Add the patient's registration card.", docIds: withName.map((d) => d.id), source: "rule" };
  }
  const names = new Set(withName.map((d) => patientKey(d.extraction!.patientName)));
  const problems: string[] = [];
  if (names.size > 1) problems.push(`names differ: ${[...new Set(withName.map((d) => d.extraction!.patientName))].map((n) => `“${n}”`).join(" vs ")}`);
  const ages: { age: number; where: string }[] = [];
  for (const d of withName) {
    const e = d.extraction!;
    if (e.patientDob) {
      const a = ageFromDob(e.patientDob, on);
      if (a != null) ages.push({ age: a, where: `born ${e.patientDob} on the ${labelOf(d)}` });
    }
    if (e.patientAge != null && !(e.patientDob && ageFromDob(e.patientDob, on) != null)) ages.push({ age: e.patientAge, where: `age ${e.patientAge} on the ${labelOf(d)}` });
  }
  if (ages.length >= 2) {
    const min = Math.min(...ages.map((a) => a.age)), max = Math.max(...ages.map((a) => a.age));
    if (max - min > 1) problems.push(`ages don't agree: ${ages.map((a) => a.where).join(", ")}`);
  }
  return problems.length
    ? { id: "identity", label: "Same patient on every document", status: "fail", detail: `The documents disagree about the patient — ${problems.join("; ")}.`, docIds: withName.map((d) => d.id), source: "rule" }
    : { id: "identity", label: "Same patient on every document", status: "pass", detail: `${withName.length} documents agree on the patient's name and age.`, docIds: withName.map((d) => d.id), source: "rule" };
}

export function duplicateChecks(docs: Doc[], campaignId: string, prior: PriorDoc[]): Check[] {
  const others = prior.filter((p) => p.campaignId !== campaignId);
  const hits: string[] = [];
  const ids: string[] = [];
  const refs = new Map<string, string>();
  for (const d of docs) {
    const e = d.extraction;
    const sameFile = others.filter((p) => p.sha256 === d.sha256);
    const fp = e ? fingerprintOf(e) : "";
    const reused = fp ? others.filter((p) => p.fingerprint === fp && p.sha256 !== d.sha256) : [];
    // A re-saved, re-scanned or cropped copy: different bytes, same picture.
    const lookalike = others.filter((p) => p.sha256 !== d.sha256 && looksAlike(p.phash, d.phash));
    const camps = new Set([...sameFile, ...reused, ...lookalike].map((p) => p.campaignId));
    if (!camps.size) continue;
    ids.push(d.id);
    [...sameFile, ...reused, ...lookalike].forEach((p) => refs.set(p.campaignId, p.campaignLabel));
    const fileCamps = new Set(sameFile.map((p) => p.campaignId));
    const picCamps = new Set(lookalike.map((p) => p.campaignId).filter((x) => !fileCamps.has(x)));
    const numCamps = new Set(reused.map((p) => p.campaignId).filter((x) => !fileCamps.has(x)));
    const plural = (n: number) => `${n} other campaign${n > 1 ? "s" : ""}`;
    const parts: string[] = [];
    if (fileCamps.size) parts.push(`the ${labelOf(d)} is an exact copy of a file in ${plural(fileCamps.size)}`);
    if (picCamps.size) {
      const best = Math.max(...lookalike.filter((p) => picCamps.has(p.campaignId)).map((p) => visualSimilarity(p.phash, d.phash)));
      parts.push(`${fileCamps.size ? "it" : `the ${labelOf(d)}`} is a re-saved or re-scanned copy of a page in ${plural(picCamps.size)} (${Math.round(best * 100)}% visual match)`);
    }
    if (numCamps.size) {
      const otherPatient = reused.some((p) => numCamps.has(p.campaignId) && p.patientKey !== patientKey(e!.patientName));
      parts.push(`${fileCamps.size || picCamps.size ? "its number " : ""}${e!.documentNumber} ${fileCamps.size || picCamps.size ? "also appears" : "already appears"} in ${plural(numCamps.size)}${otherPatient ? " for a different patient" : ""}`);
    }
    hits.push(parts.join(", and "));
  }
  return [
    hits.length
      ? { id: "duplicate", label: "Documents not reused", status: "fail", detail: `Reused document: ${hits.join("; ")}.`, docIds: ids, source: "rule", refs: [...refs].map(([campaignId, label]) => ({ campaignId, label })) }
      : { id: "duplicate", label: "Documents not reused", status: "pass", detail: "None of these documents, copies of them, or their document numbers appear in any other campaign.", docIds: [], source: "rule" },
  ];
}

export function injectionCheck(docs: Doc[]): Check {
  const hits = docs.filter((d) => d.extraction?.instructionsToReader?.trim());
  return hits.length
    ? {
        id: "injection",
        label: "No hidden instructions",
        status: "fail",
        detail: `The ${hits.map(labelOf).join(" and ")} contains text addressed to the reviewer: “${hits[0].extraction!.instructionsToReader.slice(0, 160).replace(/[.\s]+$/, "")}”. Genuine hospital documents never do this; it was ignored.`,
        docIds: hits.map((d) => d.id),
        source: "ai",
      }
    : { id: "injection", label: "No hidden instructions", status: "pass", detail: "No text in the documents tries to instruct the reviewer.", docIds: [], source: "ai" };
}

export function tamperCheck(docs: Doc[]): Check {
  const sig = docs.flatMap((d) => (d.extraction?.tamperSignals ?? []).map((s) => ({ d, s })));
  return sig.length
    ? { id: "tamper", label: "No signs of editing", status: "warn", detail: sig.map(({ d, s }) => `${capital(labelOf(d))}: ${s}`).join(" "), docIds: [...new Set(sig.map((x) => x.d.id))], source: "ai" }
    : { id: "tamper", label: "No signs of editing", status: "pass", detail: "The reader saw no edited numbers, mismatched fonts or pasted regions.", docIds: [], source: "ai" };
}

export function datesCheck(e: Extraction, docId: string, on: Date, maxAgeDays = 90): Check {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.documentDate)) {
    return { id: "dates", label: "Document is current", status: "warn", detail: "The document date could not be read.", docIds: [docId], source: "rule" };
  }
  const t = Date.parse(e.documentDate + "T00:00:00Z");
  const days = Math.floor((on.getTime() - t) / 864e5);
  if (days < -1) return { id: "dates", label: "Document is current", status: "fail", detail: `The document is dated ${e.documentDate}, in the future.`, docIds: [docId], source: "rule" };
  if (days > maxAgeDays) return { id: "dates", label: "Document is current", status: "warn", detail: `The document is ${days} days old; hospitals usually reissue estimates after ${maxAgeDays} days.`, docIds: [docId], source: "rule" };
  return { id: "dates", label: "Document is current", status: "pass", detail: `Issued ${e.documentDate} (${Math.max(0, days)} days ago).`, docIds: [docId], source: "rule" };
}

export function clinicalCheck(docs: Doc[]): Check {
  const note = docs.find((d) => d.kind === "medical_note" && d.extraction);
  return note
    ? { id: "clinical", label: "Treatment is documented by a doctor", status: "pass", detail: `A clinical note from ${note.extraction!.providerName || "the hospital"} documents ${note.extraction!.diagnosis || note.extraction!.procedure || "the condition"}.`, docIds: [note.id], source: "rule" }
    : { id: "clinical", label: "Treatment is documented by a doctor", status: "warn", detail: "No clinical note was uploaded. Campaigns are stronger with a doctor's note.", docIds: [], source: "rule" };
}

/** Run every campaign-level check and decide. */
export function verifyCampaign(args: { campaignId: string; docs: Doc[]; provider: Provider; prior: PriorDoc[]; on?: Date }): VerificationReport {
  const on = args.on ?? new Date();
  const est = args.docs.find((d) => d.kind === "estimate");
  const checks: Check[] = [];
  if (!est?.extraction) {
    checks.push({ id: "estimate", label: "Hospital estimate provided", status: "fail", detail: "No readable hospital estimate was uploaded.", docIds: [], source: "rule" });
    return decide(checks, 0);
  }
  const e = est.extraction;
  checks.push(...providerChecks(e, args.provider, est.id));
  checks.push(arithmeticCheck(e, est.id));
  checks.push(identityCheck(args.docs, on));
  checks.push(...duplicateChecks(args.docs, args.campaignId, args.prior));
  checks.push(datesCheck(e, est.id, on));
  checks.push(clinicalCheck(args.docs));
  checks.push(tamperCheck(args.docs));
  checks.push(injectionCheck(args.docs));
  if (e.readerConfidence < 0.6) {
    checks.push({ id: "legibility", label: "Documents are legible", status: "warn", detail: `The estimate was hard to read (confidence ${Math.round(e.readerConfidence * 100)}%). Upload a clearer photo or the PDF.`, docIds: [est.id], source: "ai" });
  }
  // The goal is the amount the documents actually support: the printed total if the
  // arithmetic holds, otherwise only what the itemised lines add up to.
  const arithmeticOk = checks.find((c) => c.id === "arithmetic")?.status === "pass";
  const lineSum = Math.round(e.lineItems.reduce((t, l) => t + (l.amount || 0), 0) * 100) / 100;
  return decide(checks, arithmeticOk && e.total ? e.total : lineSum);
}

const HIGH_RISK = new Set(["duplicate", "injection", "provider_match", "identity"]);

/** Rules never reject on their own. A failed check HOLDS the campaign for a person to review,
 *  with the evidence; the family can respond; only a human reviewer can reject. Real patients
 *  are never turned away by a model or a regex. */
export function decide(checks: Check[], goal: number): VerificationReport {
  const fails = checks.filter((c) => c.status === "fail");
  const warns = checks.filter((c) => c.status === "warn");
  const decision: VerificationReport["decision"] = fails.length || warns.length >= 3 ? "needs_review" : "verified";
  const risk: VerificationReport["risk"] = fails.length >= 2 || fails.some((f) => HIGH_RISK.has(f.id)) ? "high" : fails.length || warns.length >= 2 ? "medium" : "low";
  const summary =
    decision === "verified"
      ? `All ${checks.length} checks passed${warns.length ? ` (${warns.length} minor note${warns.length > 1 ? "s" : ""})` : ""}. The goal is set to the hospital's verified estimate.`
      : fails.length
        ? `${fails.length} check${fails.length > 1 ? "s" : ""} failed. Nobody can donate until a person reviews the evidence, and the family can respond.`
        : `${warns.length} checks need attention. A person will review the campaign before it goes live.`;
  return { decision, risk, verifiedGoal: goal, checks, summary, at: new Date().toISOString() };
}

function labelOf(d: Doc) {
  return { estimate: "estimate", identity: "registration card", medical_note: "clinical note", final_bill: "final bill", receipt: "receipt" }[d.kind];
}
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
