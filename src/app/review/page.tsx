import { listCampaigns } from "@/lib/store";
import CampaignList from "@/components/CampaignList";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review queue — Earmark" };

export default async function Review() {
  const all = await listCampaigns();
  const queue = all.filter((c) => c.status === "needs_review" || c.status === "bill_needs_review");
  const rejected = all.filter((c) => c.status === "rejected");
  return (
    <div className="wrap">
      <div className="page-head">
        <div><h1>Review queue</h1><p className="muted" style={{ marginTop: 6 }}>When the checks aren&apos;t sure, a person decides. Rejected campaigns can never take money.</p></div>
      </div>
      <h2 style={{ fontSize: 20, margin: "6px 0 12px" }}>Waiting for a decision</h2>
      <CampaignList campaigns={queue} role="reviewer" empty="Nothing is waiting. Everything has been verified or rejected automatically." />
      <h2 style={{ fontSize: 20, margin: "30px 0 12px" }}>Rejected automatically</h2>
      <CampaignList campaigns={rejected} role="reviewer" empty="No campaigns have been rejected." />
    </div>
  );
}
