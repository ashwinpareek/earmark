import { listCampaigns } from "@/lib/store";
import CampaignList from "@/components/CampaignList";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review queue — Earmark" };

export default async function Review() {
  const all = await listCampaigns();
  const queue = all.filter((c) => c.status === "needs_review" || c.status === "bill_needs_review" || c.careCosts.some((k) => k.status === "held"))
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.verification?.risk ?? "low"] - { high: 0, medium: 1, low: 2 }[b.verification?.risk ?? "low"]));
  const rejected = all.filter((c) => c.status === "rejected");
  return (
    <div className="wrap">
      <div className="page-head">
        <div><h1>Review queue</h1><p className="muted" style={{ marginTop: 6 }}>Rules never reject anyone. When a check fails, the campaign is held here with its evidence, the family can respond, and a person decides. Highest risk first.</p></div>
      </div>
      <h2 style={{ fontSize: 20, margin: "6px 0 12px" }}>Waiting for a decision</h2>
      <CampaignList campaigns={queue} role="reviewer" empty="Nothing is waiting for a decision." />
      <h2 style={{ fontSize: 20, margin: "30px 0 12px" }}>Rejected by a reviewer</h2>
      <CampaignList campaigns={rejected} role="reviewer" empty="No campaigns have been rejected." />
    </div>
  );
}
