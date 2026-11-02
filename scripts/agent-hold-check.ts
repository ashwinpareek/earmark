// Manual check: place one Giving Agent hold with a saved PayPal token on the sandbox.
// Usage: DATA_DIR=<copy> VAULT_ID=<token> npx tsx scripts/agent-hold-check.ts
import { saveMandate, listCampaigns } from "../src/lib/store";
import { placeAgentHold } from "../src/lib/workflow";
import { bindTools } from "../src/lib/agent-tools";
import { nowIso, uid } from "../src/lib/util";

const main = async () => {
  const c = (await listCampaigns(["main"])).find((x) => x.title.includes("Sam"));
  if (!c) throw new Error("no catalog campaign");
  const m = { id: uid("mdt"), space: "check", donorName: "Grace", donorEmail: "grace@example.com", limitCents: 10000, perGiftCents: 4000, cause: "children's surgery", status: "active" as const, vaultId: process.env.VAULT_ID!, gifts: [], createdAt: nowIso() };
  await saveMandate(m);
  const tools = bindTools(m.id);
  console.log("over the per-gift limit:", await tools.give(c.id, 5000, "test"));
  console.log("within the mandate:", await placeAgentHold(m.id, c.id, 2500, "Sam's femur surgery passed every check that matters."));
  console.log("same family twice:", await tools.give(c.id, 1000, "again"));
};
main().catch((e) => { console.error(e); process.exit(1); });
