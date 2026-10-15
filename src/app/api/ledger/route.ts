import { handle } from "@/lib/http";
import { listCampaigns, listWebhooks } from "@/lib/store";
import { provider } from "@/lib/providers";

export const dynamic = "force-dynamic";

// Public transparency data for the AG Studio ledger. No donor emails, no patient full names.
export async function GET() {
  return handle(async () => {
    const cs = await listCampaigns();
    const campaigns = cs.map((c) => ({
      id: c.id, title: c.title, patient: c.patient.displayName, hospital: provider(c.providerId)?.name ?? "", status: c.status,
      decision: c.verification?.decision ?? "pending", goal: Number(c.goal), currency: c.currency, createdAt: c.createdAt.slice(0, 10),
      pledged: c.donations.filter((d) => ["held", "captured", "voided"].includes(d.status)).reduce((s, d) => s + Number(d.pledged), 0),
      charged: Number(c.settlement?.captured ?? 0), neverCharged: Number(c.settlement?.neverCharged ?? 0),
      paidToHospital: c.settlement?.direct ? Number(c.settlement.captured) : c.movements.filter((m) => m.type === "payout" && m.payee === provider(c.providerId)?.name).reduce((s, m) => s + Number(m.amount), 0),
      paidToPharmacies: c.movements.filter((m) => m.type === "payout" && m.payee && m.payee !== provider(c.providerId)?.name).reduce((s, m) => s + Number(m.amount), 0),
      checksFailed: c.verification?.checks.filter((k) => k.status === "fail").length ?? 0,
      paidToFamily: 0, // by construction: money only ever moves to the hospital's registered account
      // the inflated amount fraudulent campaigns asked for, held or rejected before anyone could give
      blocked: c.status === "rejected" || (c.status === "needs_review" && c.verification?.risk === "high") ? Number(c.docs.find((d) => d.kind === "estimate")?.extraction?.total ?? 0) : 0,
    }));
    const donations = cs.flatMap((c) => c.donations.filter((d) => d.status !== "pending").map((d) => ({
      id: d.id, campaignId: c.id, donor: d.anonymous ? "Anonymous" : d.donorName, status: d.status, pledged: Number(d.pledged),
      charged: Number(d.captured ?? 0), neverCharged: Number(d.neverCharged ?? (d.status === "held" ? 0 : 0)), date: d.createdAt.slice(0, 10),
    })));
    const movements = cs.flatMap((c) => c.movements.map((m) => ({
      id: m.id, campaignId: c.id, type: m.type, amount: Number(m.amount), currency: m.currency, paypalId: m.paypalId, status: m.status,
      donationId: m.donationId ?? "", note: m.note ?? "", date: m.at.slice(0, 10), at: m.at,
    })));
    const checks = cs.flatMap((c) => [...(c.verification?.checks ?? []).map((k) => ({ stage: "Campaign" as const, k })), ...(c.billReview?.checks ?? []).map((k) => ({ stage: "Final bill" as const, k }))]
      .map(({ stage, k }, i) => ({ id: `${c.id}-${i}`, campaignId: c.id, stage, check: k.label, status: k.status, source: k.source === "ai" ? "AI" : "Rule" })));
    const billLines = cs.flatMap((c) => (c.billReview?.lines ?? []).map((l, i) => ({ id: `${c.id}-l${i}`, campaignId: c.id, line: l.description, amount: l.amount, estimate: l.estimateAmount ?? 0, covered: l.covered ? "Covered" : "Not covered", reason: l.reason })));
    return { asOf: new Date().toISOString(), campaigns, donations, movements, checks, billLines, webhooks: await listWebhooks() };
  });
}
