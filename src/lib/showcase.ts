import type { Campaign } from "./types";
import { listCampaigns } from "./store";
import { provider } from "./providers";
import { CATALOG_SPACE } from "./catalog";

// What the home page's animations show, taken from real campaigns in the shared space: the hero's
// stream of uploads turning into verified gifts, and the money in the document tunnel. Falls back to
// the components' built-in examples when there isn't enough activity yet.

export type BeamRaw = { file: string; lines: number; img?: boolean };
export type BeamDone =
  | { k: "verified"; who: string; what: string; where: string; amt: string }
  | { k: "hold"; who: string; amt: string; id: string }
  | { k: "paid"; where: string; amt: string }
  | { k: "held"; why: string; amt: string };
export type BeamCard = { raw: BeamRaw; done: BeamDone };
export type TunnelMoney = { patient: string; pledged: number; donors: number; paid: number; hospital: string; neverCharged: number };

const usd = (n: number, cents = false) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }).format(n);
const shortId = (id: string) => (id.length > 10 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id);
const who = (c: Campaign) => `${c.patient.displayName.replace(/\.$/, "")}${c.patient.age !== null ? `, ${c.patient.age}` : ""}`;
const lines = (s: string) => 3 + (s.length % 3);

export async function showcase(): Promise<{ beam?: BeamCard[][]; tunnel?: TunnelMoney }> {
  const cs = await listCampaigns([CATALOG_SPACE]).catch(() => [] as Campaign[]);
  const verified: BeamCard[] = [], holds: BeamCard[] = [], paid: BeamCard[] = [], caught: BeamCard[] = [];
  for (const c of cs) {
    const files = c.docs.map((d) => d.filename);
    const f = (i: number) => files[i % Math.max(1, files.length)] ?? "estimate.png";
    const est = c.docs.find((d) => d.kind === "estimate")?.extraction;
    const hosp = provider(c.providerId)?.name ?? "";
    if (c.verification?.decision === "verified" && ["live", "settled", "settling"].includes(c.status)) {
      verified.push({ raw: { file: f(0), lines: lines(c.id) }, done: { k: "verified", who: who(c), what: est?.procedure ?? "Surgery", where: hosp, amt: usd(Number(c.goal)) } });
    }
    c.donations.filter((d) => d.authorizationId && ["held", "captured"].includes(d.status)).forEach((d, i) => {
      holds.push({ raw: { file: f(i + 1), lines: lines(d.id), img: f(i + 1).endsWith(".jpg") }, done: { k: "hold", who: `for ${c.patient.displayName}`, amt: usd(Number(d.pledged), true), id: shortId(d.authorizationId!) } });
    });
    c.movements.filter((m) => m.type === "payout").forEach((m, i) => {
      paid.push({ raw: { file: files.find((x) => x.includes("bill") || x.includes("receipt")) ?? f(i), lines: 4 }, done: { k: "paid", where: m.payee ?? hosp, amt: usd(Number(m.amount), true) } });
    });
    const failed = c.verification?.checks.filter((k) => k.status === "fail") ?? [];
    if (["needs_review", "rejected"].includes(c.status) && failed.length) {
      caught.push({ raw: { file: f(0), lines: 4, img: f(0).endsWith(".jpg") }, done: { k: "held", why: `${failed[0].label} · ${failed.length} check${failed.length > 1 ? "s" : ""} failed`, amt: usd(Number(est?.total ?? c.goal)) } });
    }
  }
  const pools = [verified, holds, paid, caught].filter((p) => p.length);
  const mixed: BeamCard[] = [];
  for (let i = 0; mixed.length < 18 && pools.some((p) => p.length); i++) {
    const p = pools[i % pools.length];
    if (p.length) mixed.push(p.shift()!);
    if (i > 200) break;
  }
  const beam = verified.length + holds.length >= 4 && mixed.length >= 9
    ? [0, 1, 2].map((r) => Array.from({ length: 6 }, (_, j) => mixed[(r * 6 + j) % mixed.length]))
    : undefined;

  // The tunnel follows the most recently settled campaign: its pledges, then what the hospital was paid.
  const s = cs.filter((c) => c.settlement && !c.settlement.direct).sort((a, b) => (b.settlement!.at ?? "").localeCompare(a.settlement!.at ?? ""))[0];
  const tunnel = s
    ? {
        patient: s.patient.displayName.split(" ")[0],
        pledged: s.donations.filter((d) => ["captured", "voided", "held"].includes(d.status)).reduce((t, d) => t + Number(d.pledged), 0),
        donors: s.donations.filter((d) => ["captured", "voided", "held"].includes(d.status)).length,
        paid: s.movements.filter((m) => m.type === "payout" && m.payee === provider(s.providerId)?.name).reduce((t, m) => t + Number(m.amount), 0),
        hospital: provider(s.providerId)?.name ?? "the hospital",
        neverCharged: Number(s.settlement!.neverCharged),
      }
    : undefined;
  return { beam, tunnel };
}
