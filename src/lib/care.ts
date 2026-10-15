import type { Campaign, CareCost, Check, Doc } from "./types";
import { arithmeticCheck, datesCheck, duplicateChecks, injectionCheck, patientKey, providerChecks, tamperCheck, type PriorDoc } from "./forensics";
import { findByName } from "./providers";
import { classifyBillLines } from "./agents";
import { uid } from "./util";

// CARE COSTS — families also pay for medicines and supplies outside the hospital.
// Earmark allows a small, capped share of the verified goal for these, against VERIFIED
// RECEIPTS, and pays the ISSUER (a verified pharmacy or supply store) directly. The
// family still never receives money, so the core promise holds.

export const CARE_CAP = 0.1; // at most 10% of the verified goal

const usd = (n: number, cur = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(n);
const r2 = (n: number) => Math.round(n * 100) / 100;

export function careRoom(c: Campaign, excludeId?: string) {
  const cap = r2(Number(c.goal) * CARE_CAP);
  const used = r2(c.careCosts.filter((x) => x.id !== excludeId && x.status !== "held").reduce((s, x) => s + x.approved, 0));
  return { cap, used, left: Math.max(0, r2(cap - used)) };
}

export async function reviewReceipt(args: { campaign: Campaign; doc: Doc; prior: PriorDoc[]; on?: Date }): Promise<CareCost> {
  const { campaign: c, doc } = args;
  const e = doc.extraction!;
  const cur = c.currency;
  const checks: Check[] = [];
  const issuer = findByName(e.providerName, ["pharmacy", "medical_supplies", "hospital", "clinic"]);

  if (issuer) {
    checks.push(...providerChecks(e, issuer, doc.id, "receipt").map((k) => (k.id === "provider_match" ? { ...k, label: "Issued by a verified provider" } : k)));
  } else {
    checks.push({ id: "provider_match", label: "Issued by a verified provider", status: "fail", detail: `“${e.providerName || "Unknown issuer"}” isn't a verified pharmacy or supplier, so Earmark can't pay it directly.`, docIds: [doc.id], source: "rule" });
  }
  checks.push(arithmeticCheck(e, doc.id));
  const est = c.docs.find((d) => d.kind === "estimate")?.extraction;
  const samePatient = !e.patientName || (est && patientKey(e.patientName) === patientKey(est.patientName));
  checks.push({
    id: "bill_patient",
    label: "For the verified patient",
    status: samePatient ? (e.patientName ? "pass" : "warn") : "fail",
    detail: !e.patientName ? "The receipt doesn't name a patient." : samePatient ? `The receipt is for ${e.patientName}.` : `The receipt names “${e.patientName}”, not the verified patient.`,
    docIds: [doc.id],
    source: "rule",
  });
  checks.push(...duplicateChecks([doc], c.id, args.prior));
  checks.push(datesCheck(e, doc.id, args.on ?? new Date(), 60));
  checks.push(tamperCheck([doc]));
  checks.push(injectionCheck([doc]));

  const cls = await classifyBillLines(est?.procedure ?? "", est?.diagnosis ?? "", e.lineItems);
  const excluded = e.lineItems.filter((_, i) => !cls.lines[i].covered);
  const covered = r2(e.lineItems.filter((_, i) => cls.lines[i].covered).reduce((s, l) => s + l.amount, 0));
  const room = careRoom(c);
  const approved = r2(Math.min(covered, room.left));
  const fails = checks.filter((k) => k.status === "fail");
  const claimed = r2(e.total ?? e.lineItems.reduce((s, l) => s + l.amount, 0));

  const parts: string[] = [`${issuer?.name ?? e.providerName} receipt for ${usd(claimed, cur)}.`];
  if (excluded.length) parts.push(`${excluded.map((l) => `${l.description} (${usd(l.amount, cur)})`).join(", ")} ${excluded.length > 1 ? "aren't" : "isn't"} medical care.`);
  if (covered > room.left) parts.push(`Capped at the ${CARE_CAP * 100}% care allowance (${usd(room.left, cur)} left of ${usd(room.cap, cur)}).`);
  parts.push(fails.length ? "Held for a reviewer." : `${usd(approved, cur)} will be paid directly to ${issuer!.name} at settlement.`);

  return {
    id: uid("care"),
    docId: doc.id,
    providerId: issuer?.id ?? null,
    issuer: issuer?.name ?? e.providerName,
    claimed,
    eligible: approved,
    approved: fails.length ? 0 : approved,
    status: fails.length ? "held" : "approved",
    checks,
    note: parts.join(" "),
    at: new Date().toISOString(),
  };
}
