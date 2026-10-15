import { listCampaigns } from "@/lib/store";
import { visibleSpaces } from "@/lib/space";
import { providers } from "@/lib/providers";
import CampaignList from "@/components/CampaignList";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hospital billing — Earmark" };

export default async function Hospital({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const all = providers();
  const me = all.find((x) => x.id === p) ?? all[0];
  const cs = (await listCampaigns(await visibleSpaces())).filter((c) => c.providerId === me.id && !["rejected", "verifying"].includes(c.status));
  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1>{me.name}</h1>
          <p className="muted" style={{ marginTop: 6 }}>Billing office · {me.city} · verified since {me.verifiedSince}. Payments arrive at your registered PayPal account.</p>
        </div>
        <form className="row">
          <select name="p" defaultValue={me.id} aria-label="Hospital" style={{ width: "auto" }}>{all.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <button className="btn ghost sm">Switch</button>
        </form>
      </div>
      <p className="small muted" style={{ marginBottom: 12 }}>Campaigns raising money for your patients. Open one to submit the final bill.</p>
      <CampaignList campaigns={cs} role="hospital" empty="No campaigns name your hospital yet." />
      <p className="tiny muted" style={{ marginTop: 14 }}>Demo: there is no sign-in. In production this page belongs to the hospital&apos;s verified billing account.</p>
    </div>
  );
}
