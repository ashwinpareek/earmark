import type { Campaign } from "./types";
import { catalog, CATALOG_SPACE } from "./catalog";
import { getCampaign, getMandate } from "./store";
import { candidateOf, placeAgentHold } from "./workflow";
import { checkGift, publicMandate, remainingCents, type Mandate } from "./mandate";
import type { AgentTools, GiveResult } from "./giving-agent";
import { toCents } from "./util";

// Binds the Giving Agent's tools to one donor's mandate. The agent never sees the PayPal token,
// and every gift goes through checkGift (code) before PayPal is called.

const words = (s: string) => s.toLowerCase().match(/[a-z]{3,}/g) ?? [];

export async function searchCatalog(query: string, baseUrl = "") {
  const q = new Set(words(query));
  const all = await catalog(baseUrl);
  const scored = all.map((c) => {
    const hay = words(`${c.title} ${c.procedure} ${c.diagnosis} ${c.hospital} ${c.city}`);
    let score = hay.filter((w) => q.has(w)).length;
    if ((q.has("child") || q.has("children") || q.has("kid") || q.has("kids")) && c.age !== null && c.age < 18) score += 1;
    return { c, score };
  });
  return scored
    .sort((a, b) => b.score - a.score || Number(a.c.stillNeeds) - Number(b.c.stillNeeds))
    .map(({ c }) => c);
}

export async function campaignEvidence(id: string) {
  const c = await getCampaign(id);
  if (!c || (c.space ?? "main") !== CATALOG_SPACE) return { error: "Not a catalog campaign." };
  return evidenceOf(c);
}

export function evidenceOf(c: Campaign) {
  return {
    campaign_id: c.id,
    patient: c.patient.displayName,
    status: c.status,
    decision: c.verification?.decision,
    checks: (c.verification?.checks ?? []).map((k) => ({ check: k.label, result: k.status, evidence: k.detail })),
    verified_facts: c.facts,
  };
}

export function bindTools(mandateId: string, baseUrl = ""): AgentTools {
  const load = async () => {
    const m = await getMandate(mandateId);
    if (!m) throw new Error("Mandate not found");
    return m;
  };
  return {
    search: (q) => searchCatalog(q, baseUrl),
    evidence: (id) => campaignEvidence(id),
    mandate: async () => {
      const m = await load();
      return { donor: m.donorName, cause: m.cause, limit: (m.limitCents / 100).toFixed(2), perGift: (m.perGiftCents / 100).toFixed(2), remaining: (remainingCents(m) / 100).toFixed(2), approvedWithPayPal: m.status === "active", alreadyGaveTo: m.gifts.map((g) => g.patient) };
    },
    give: async (campaignId, cents, reason): Promise<GiveResult> => {
      const m = await load();
      const c = await getCampaign(campaignId);
      if (!c || (c.space ?? "main") !== CATALOG_SPACE) return { placed: false, why: "That campaign isn't in the verified catalog." };
      if (m.status !== "active") {
        const stillNeeds = Math.max(0, toCents(c.goal) - c.donations.filter((d) => d.status === "held").reduce((s, d) => s + toCents(d.pledged), 0));
        const v = checkGift(m, candidateOf(c, stillNeeds), cents, { requireActive: false });
        if (!v.ok) return { placed: false, why: v.why };
        return { needsApproval: true, campaignId, patient: c.patient.displayName, amount: (cents / 100).toFixed(2), reason };
      }
      const r = await placeAgentHold(mandateId, campaignId, cents, reason);
      return r.placed ? { placed: true, authorizationId: r.authorizationId, amount: r.amount, patient: r.patient, campaignId } : { placed: false, why: r.why };
    },
  };
}

export { publicMandate };
export type { Mandate };
