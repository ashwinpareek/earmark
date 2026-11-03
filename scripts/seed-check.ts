// Rehearse the shared demo seed against the PayPal sandbox with a scratch DATA_DIR.
import { seedActivity } from "../src/lib/seed-activity";
import { listCampaigns } from "../src/lib/store";
(async () => {
  const t0 = Date.now();
  console.log("result:", await seedActivity(), `${Math.round((Date.now() - t0) / 1000)}s`);
  for (const c of await listCampaigns(["main"])) {
    const held = c.donations.filter((d) => d.status === "held").length;
    console.log(`${c.patient.displayName.padEnd(10)} ${c.status.padEnd(13)} donors:${c.donations.length} held:${held} movements:${c.movements.map((m) => `${m.type}:${m.amount}:${m.status}`).join(" ")}`);
    if (c.settlement) console.log("   settlement", JSON.stringify(c.settlement));
  }
})().catch((e) => { console.error("ERR", e); process.exit(1); });
