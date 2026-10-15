import type { BillLineReview, BillReview, Campaign, Check, Doc, LineItem, Provider } from "./types";
import { arithmeticCheck, duplicateChecks, injectionCheck, patientKey, providerChecks, tamperCheck, datesCheck, type PriorDoc } from "./forensics";
import { classifyBillLines } from "./agents";

// BILL RECONCILER — when the hospital submits the final bill:
//  1. the same forensic rules run on the bill (issuer, arithmetic, reuse, hidden text, tampering)
//  2. the bill's patient must be the campaign's verified patient
//  3. each bill line is matched to the verified estimate, and classified as covered or not
//  4. growth beyond the verified estimate is flagged — the classic fraud pattern where a
//     target quietly triples after launch
// The decision and the payable amount come from code; the AI only classifies lines.

export const POLICY = {
  maxGrowthOverEstimate: 0.15, // covered total may exceed the verified estimate by ≤15% before a human looks
  lineGrowthWarn: 0.25,
} as const;

const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
const STOP = new Set(["and", "the", "for", "per", "with", "fee", "fees", "services", "service", "estimated", "up", "to", "minutes"]);

export function similarity(a: string, b: string) {
  const x = words(a), y = words(b);
  if (!x.size || !y.size) return 0;
  let inter = 0;
  for (const w of x) if (y.has(w)) inter++;
  return inter / (x.size + y.size - inter);
}

export function matchLines(bill: LineItem[], estimate: LineItem[]): (number | null)[] {
  const used = new Set<number>();
  return bill.map((b) => {
    let best = -1, score = 0;
    estimate.forEach((e, i) => {
      if (used.has(i)) return;
      const s = similarity(b.description, e.description);
      if (s > score) { score = s; best = i; }
    });
    if (best >= 0 && score >= 0.34) { used.add(best); return best; }
    return null;
  });
}

const usd = (n: number, cur = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(n);
const r2 = (n: number) => Math.round(n * 100) / 100;

export async function reviewBill(args: { campaign: Campaign; bill: Doc; provider: Provider; prior: PriorDoc[]; on?: Date }): Promise<BillReview> {
  const { campaign: c, bill, provider } = args;
  const e = bill.extraction!;
  const est = c.docs.find((d) => d.kind === "estimate")?.extraction;
  const cur = c.currency;
  const checks: Check[] = [];

  checks.push(...providerChecks(e, provider, bill.id, "bill"));
  checks.push(arithmeticCheck(e, bill.id));
  const samePatient = est && patientKey(e.patientName) === patientKey(est.patientName);
  checks.push({
    id: "bill_patient",
    label: "Bill is for the verified patient",
    status: samePatient ? "pass" : "fail",
    detail: samePatient ? `The bill is for ${e.patientName}, the patient verified at launch.` : `The bill names “${e.patientName || "nobody"}”, not the verified patient.`,
    docIds: [bill.id],
    source: "rule",
  });
  checks.push(...duplicateChecks([bill], c.id, args.prior));
  checks.push(datesCheck(e, bill.id, args.on ?? new Date(), 120));
  checks.push(tamperCheck([bill]));
  checks.push(injectionCheck([bill]));

  // line review
  const estLines = est?.lineItems ?? [];
  const matches = matchLines(e.lineItems, estLines);
  const cls = await classifyBillLines(est?.procedure || e.procedure, est?.diagnosis || e.diagnosis, e.lineItems);
  const lines: BillLineReview[] = e.lineItems.map((l, i) => {
    const m = matches[i];
    const k = cls.lines[i];
    return {
      description: l.description,
      amount: r2(l.amount),
      estimateAmount: m == null ? null : r2(estLines[m].amount),
      covered: k.covered,
      reason: k.reason,
    };
  });
  const grew = lines.filter((l) => l.covered && l.estimateAmount != null && l.amount > l.estimateAmount * (1 + POLICY.lineGrowthWarn));
  const newCovered = lines.filter((l) => l.covered && l.estimateAmount == null);
  if (grew.length || newCovered.length) {
    checks.push({
      id: "line_changes",
      label: "Charges match the estimate",
      status: "warn",
      detail: [
        ...grew.map((l) => `“${l.description}” rose from ${usd(l.estimateAmount!, cur)} to ${usd(l.amount, cur)}`),
        ...newCovered.map((l) => `“${l.description}” (${usd(l.amount, cur)}) wasn't on the estimate`),
      ].join("; ") + ".",
      docIds: [bill.id],
      source: "rule",
    });
  } else {
    checks.push({ id: "line_changes", label: "Charges match the estimate", status: "pass", detail: "Every covered charge was on the verified estimate at the same or a lower price.", docIds: [bill.id], source: "rule" });
  }

  const covered = r2(lines.filter((l) => l.covered).reduce((s, l) => s + l.amount, 0));
  const billTotal = r2(e.total ?? lines.reduce((s, l) => s + l.amount, 0));
  const goal = Number(c.goal);
  const ceiling = r2(goal * (1 + POLICY.maxGrowthOverEstimate));
  // payable can't exceed what the bill actually asks for, or the covered lines
  let payable = r2(Math.min(covered, billTotal));
  const growth = goal > 0 ? (payable - goal) / goal : 0;
  if (payable > ceiling) {
    checks.push({
      id: "growth",
      label: "Within the verified estimate",
      status: "fail",
      detail: `Covered charges of ${usd(payable, cur)} are ${Math.round(growth * 100)}% above the verified estimate of ${usd(goal, cur)}. A reviewer must approve anything over ${usd(ceiling, cur)}.`,
      docIds: [bill.id],
      source: "rule",
    });
  } else {
    checks.push({
      id: "growth",
      label: "Within the verified estimate",
      status: "pass",
      detail: payable <= goal ? `Covered charges of ${usd(payable, cur)} are within the verified estimate of ${usd(goal, cur)}.` : `Covered charges are ${Math.round(growth * 100)}% above the estimate, inside the ${POLICY.maxGrowthOverEstimate * 100}% allowance.`,
      docIds: [bill.id],
      source: "rule",
    });
  }

  const fails = checks.filter((k) => k.status === "fail");
  const hard = fails.some((f) => ["duplicate", "injection", "provider_match", "bill_patient"].includes(f.id));
  const decision: BillReview["decision"] = hard || fails.length >= 2 ? "reject" : fails.length === 1 ? "needs_review" : "approve";
  if (decision === "reject") payable = 0;

  const excluded = lines.filter((l) => !l.covered);
  const explanation =
    decision === "reject"
      ? `The final bill failed ${fails.length} check${fails.length > 1 ? "s" : ""}, so nothing will be charged from donors for it.`
      : `The hospital's final bill is ${usd(billTotal, cur)}. ${
          excluded.length ? `${excluded.map((l) => `${l.description} (${usd(l.amount, cur)})`).join(", ")} ${excluded.length > 1 ? "aren't" : "isn't"} medical care, so donations won't pay for ${excluded.length > 1 ? "them" : "it"}. ` : ""
        }Donations will pay ${usd(payable, cur)} directly to ${provider.name}${payable < goal ? `, ${usd(r2(goal - payable), cur)} less than the estimate` : ""}.`;

  return { docId: bill.id, decision, billTotal, payable, lines, checks, explanation, model: cls.model, at: new Date().toISOString() };
}
