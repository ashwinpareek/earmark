import { promises as fs } from "node:fs";
import path from "node:path";
import type { Campaign } from "./types";
import { getCampaign, listCampaigns, seedMark, setSeedMark } from "./store";
import { addCareReceipt, placeSeedHold, reviewerDecideBill, reviewerDecideCare, settle, submitFinalBill, syncWithPayPal } from "./workflow";
import { copycat, ensureAarav, fraud, honest } from "./scenarios";
import { ensureCatalog, CATALOG_SPACE } from "./catalog";
import { paypalMode } from "./paypal";

// Real PayPal sandbox activity for the shared demo, so a judge who opens the site sees money that
// actually moved, not empty pages. Runs once on the server, in the background, and records each
// finished step so a restart picks up where it left off. Every call is a genuine sandbox API call:
//   Maya:      six donors' holds → the hospital's final bill → fair-share captures, the rest
//              released, and a Payouts batch to Riverside Children's (and the pharmacy)
//   Leila, Sam, Lucia, Aarav: several donors' holds each, waiting for their final bills
//   Leo and a copycat of Maya: the two scams, caught and waiting in the review queue and radar
// The donors are one sandbox buyer account whose PayPal was saved (vaulted) with its owner's
// approval; the server places merchant-initiated holds with it, as the Giving Agent does.

// A sandbox vault token for the demo donor. Useless without this app's PayPal client secret.
const DEMO_DONOR_VAULT = "3c058301jk501032h";
const KEY = "activity-v1";
const space = CATALOG_SPACE;
const file = async (name: string) => ({ filename: name, buf: Buffer.from(await fs.readFile(path.join(process.cwd(), "public", "samples", name))) });
const has = (cs: Campaign[], fname: string) => cs.find((c) => c.docs.some((d) => d.filename === fname));

const PLEDGES: Record<string, [string, string, "release" | "offer"][]> = {
  "maya-estimate.png": [["Grace", "500.00", "offer"], ["Coworkers at Hollis & Co.", "1200.00", "offer"], ["Rahul", "250.00", "release"], ["Ananya", "120.00", "release"], ["Mei", "365.00", "offer"], ["Tom", "50.00", "release"]],
  "leila-estimate.png": [["Hannah", "120.00", "release"], ["The Okafor family", "250.00", "offer"], ["Jonas", "40.00", "release"], ["Priyanka", "75.00", "release"]],
  "sam-estimate.png": [["Coach Dennis", "150.00", "release"], ["Lena", "60.00", "release"], ["Soccer parents", "320.00", "offer"]],
  "lucia-estimate.png": [["Marisol", "80.00", "release"], ["Kenji", "25.00", "release"], ["Abuela Rosa", "140.00", "offer"]],
  "aarav-estimate.png": [["Neighbours on Cedar St.", "650.00", "offer"], ["Dev", "300.00", "release"], ["Aunt Meera", "250.00", "release"]],
};

async function pledgeAll(c: Campaign, vaultId: string, fname: string) {
  const want = PLEDGES[fname] ?? [];
  for (let i = 0; i < want.length; i++) {
    const fresh = (await getCampaign(c.id))!;
    if (fresh.status !== "live") return;
    const [name, amount, surplus] = want[i];
    if (fresh.donations.some((d) => d.donorName === name)) continue;
    await placeSeedHold(c.id, vaultId, name, amount, surplus, i);
  }
}

export async function seedActivity(): Promise<string> {
  if (paypalMode() !== "sandbox" || process.env.SEED_ACTIVITY === "off") return "skipped";
  const mark = await seedMark(KEY);
  if (mark === "done") return "done";
  if (mark?.startsWith("running:") && Date.now() - Date.parse(mark.slice(8)) < 20 * 60_000) return "running";
  await setSeedMark(KEY, `running:${new Date().toISOString()}`);
  const vaultId = process.env.SEED_VAULT_ID || DEMO_DONOR_VAULT;
  try {
    await ensureCatalog();
    let all = await listCampaigns([space]);

    // 1. Maya: the whole journey, end to end.
    const maya = has(all, "maya-estimate.png") ?? (await honest(space));
    if (maya.status === "live") {
      await pledgeAll(maya, vaultId, "maya-estimate.png");
      let m = (await getCampaign(maya.id))!;
      if (!m.careCosts.length) {
        m = await addCareReceipt(m.id, await file("maya-pharmacy-receipt.png")).catch(() => m);
        const held = m.careCosts.find((k) => k.status === "held");
        if (held) m = await reviewerDecideCare(m.id, held.id, true);
      }
      m = await submitFinalBill(m.id, await file("maya-final-bill.png"));
      if (m.status === "bill_needs_review") m = await reviewerDecideBill(m.id, true, "Matches the hospital's estimate line by line.");
      if (m.status === "settling") await settle(m.id);
    }
    // Sandbox payouts start PENDING; ask PayPal again shortly so the ledger shows the final status.
    for (const ms of [60_000, 240_000]) setTimeout(() => void syncWithPayPal(maya.id).catch(() => undefined), ms).unref?.();
    console.log("[seed] Maya settled");

    // 2. The families still raising: real holds from several donors each.
    await ensureAarav(space);
    all = await listCampaigns([space]);
    for (const f of ["leila-estimate.png", "sam-estimate.png", "lucia-estimate.png", "aarav-estimate.png"]) {
      const c = has(all, f);
      if (c?.status === "live") await pledgeAll(c, vaultId, f);
    }
    console.log("[seed] families pledged");

    // 3. The two scams, caught: they wait in the review queue and on the reuse radar.
    all = await listCampaigns([space]);
    if (!has(all, "leo-estimate.png")) await fraud(space);
    if (!has(all, "estimate.jpg")) await copycat(space);
    console.log("[seed] scams caught");

    await setSeedMark(KEY, "done");
    return "done";
  } catch (e) {
    await setSeedMark(KEY, `failed:${new Date().toISOString()}:${(e as Error).message.slice(0, 200)}`);
    throw e;
  }
}
