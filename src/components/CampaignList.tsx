import Link from "next/link";
import type { Campaign, Role } from "@/lib/types";
import { provider } from "@/lib/providers";

const money = (v: number | string, c = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(Number(v));
const LABEL: Record<string, [string, string]> = {
  verifying: ["Checking", "held"], needs_review: ["On hold for review", "warn"], rejected: ["Rejected by a reviewer", "fail"], live: ["Accepting pledges", "paid"],
  bill_review: ["Checking bill", "held"], bill_needs_review: ["Bill needs review", "warn"], settling: ["Paying", "held"], settled: ["Bill paid", "paid"], cancelled: ["Cancelled", ""],
};

export default function CampaignList({ campaigns, role, empty }: { campaigns: Campaign[]; role: Role; empty: string }) {
  if (!campaigns.length) return <div className="card"><p>{empty}</p></div>;
  return (
    <div className="list">
      {campaigns.map((c) => {
        const [l, t] = LABEL[c.status] ?? [c.status, ""];
        const held = c.donations.filter((d) => d.status === "held").reduce((s, d) => s + Number(d.pledged), 0);
        return (
          <Link key={c.id} href={`/c/${c.id}?role=${role}`}>
            <div>
              <b>{c.title}</b>
              <div className="tiny muted">{c.patient.displayName} · {provider(c.providerId)?.name} · started {new Date(c.createdAt).toLocaleDateString()}</div>
            </div>
            <span className="num small">{c.settlement ? `${money(c.settlement.captured, c.currency)} paid` : `${money(held, c.currency)} of ${money(c.goal, c.currency)} held`}</span>
            <span className={`pill ${t}`}>{l}</span>
          </Link>
        );
      })}
    </div>
  );
}
