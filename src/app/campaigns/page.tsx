import Link from "next/link";
import { visibleSpaces } from "@/lib/space";
import { listCampaigns } from "@/lib/store";
import CampaignList from "@/components/CampaignList";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campaigns — Earmark" };

export default async function Campaigns() {
  const cs = (await listCampaigns(await visibleSpaces())).filter((c) => !["rejected", "verifying", "needs_review"].includes(c.status));
  return (
    <div className="wrap">
      <div className="page-head">
        <div><h1>Campaigns</h1><p className="muted" style={{ marginTop: 6 }}>Every campaign here passed document checks. Pledges are held, not charged, until the bill is verified.</p></div>
        <Link href="/start" className="btn">Start a campaign</Link>
      </div>
      <CampaignList campaigns={cs} role="donor" empty="No campaigns yet. Open a demo campaign from the home page, or start one." />
    </div>
  );
}
