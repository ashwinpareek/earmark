import Link from "next/link";
import { notFound } from "next/navigation";
import { getCampaign, listCampaigns } from "@/lib/store";
import { MIN_OFFER_CENTS, needsCents, offerOpen } from "@/lib/forward";
import { provider } from "@/lib/providers";
import Receipt from "@/components/Receipt";
import OfferCard from "@/components/OfferCard";
import WitnessCheck from "@/components/WitnessCheck";

export const dynamic = "force-dynamic";

const money = (v: number | string, c = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(Number(v));
const ok = (m?: { confirmed?: { via: string } }) =>
  !m ? "" : !m.confirmed ? " · awaiting PayPal confirmation" : m.confirmed.via === "mock" ? " · mock" : " · confirmed by PayPal";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string; did: string }> }) {
  const { id, did } = await params;
  const c = await getCampaign(id);
  const d = c?.donations.find((x) => x.id === did);
  if (!c || !d) notFound();
  const hosp = provider(c.providerId)?.name ?? "the hospital";
  const capture = c.movements.find((m) => m.type === "capture" && m.donationId === d.id);
  const hold = c.movements.find((m) => m.type === "hold" && m.donationId === d.id);
  const payout = c.movements.find((m) => m.type === "payout" && m.payee === hosp) ?? c.movements.find((m) => m.type === "payout");
  const bill = c.docs.find((x) => x.id === c.billReview?.docId)?.extraction;
  const name = d.anonymous ? "An anonymous donor" : d.donorName;
  // The other patient's need right now (not when the offer was made): others may have given since.
  let offer = d.offer;
  if (offerOpen(offer)) {
    const all = await listCampaigns([c.space ?? "main"]);
    const t = all.find((x) => x.id === offer!.campaignId);
    const mine = Math.round(Number(offer.amount) * 100);
    const now = t && t.status === "live" ? needsCents(t, all) + mine : 0; // this offer's own place counts as available to its donor
    offer = now < Math.min(mine, MIN_OFFER_CENTS) ? { ...offer, status: "declined" as const, needs: "0" } : { ...offer, needs: (now / 100).toFixed(2), amount: (Math.min(mine, now) / 100).toFixed(2) };
  }
  return (
    <div className="wrap" style={{ maxWidth: 640, padding: "40px 24px 20px" }}>
      <p className="small muted"><Link href={`/c/${c.id}`}>{c.title}</Link></p>
      <h1 style={{ fontSize: 32, letterSpacing: "-0.03em", margin: "6px 0 22px" }}>Donation receipt</h1>
      <Receipt donor={name} pledged={Number(d.pledged)} paid={Number(d.captured ?? 0)} hospital={(c.settlement?.payees?.length ?? 1) > 1 ? `${hosp} and ${c.settlement!.payees!.length - 1} pharmacy` : hosp} patient={c.patient.displayName} currency={c.currency} held={d.status === "held"} />
      <div className="card" style={{ marginTop: 18 }}>
        <h3>The trail</h3>
        <ul className="donors">
          <li><span>Pledge held on PayPal</span><span className="tiny">{hold?.paypalId ?? "—"}{ok(hold)}</span></li>
          {d.status !== "held" && <li><span>Bill verified{bill?.documentNumber ? ` (${bill.documentNumber})` : ""}</span><span className="tiny">{c.billReview ? `${money(c.billReview.payable, c.currency)} payable` : "—"}</span></li>}
          {capture && <li><span>Your share captured</span><span className="tiny">{capture.paypalId}{ok(capture)}</span></li>}
          {d.status !== "held" && <li><span>Rest of your pledge released</span><span className="tiny">{money(d.neverCharged ?? 0, c.currency)}, never charged{capture ? ` (${d.authorizationId}, closed)` : ""}</span></li>}
          {payout && <li><span>Paid directly to {hosp}</span><span className="tiny">{payout.paypalId}{ok(payout)}</span></li>}
          {d.status !== "held" && <li><span>Kept by Earmark</span><span className="tiny">{money(0, c.currency)}</span></li>}
        </ul>
      </div>
      {d.orderId && <WitnessCheck campaignId={c.id} donationId={d.id} />}
      {d.forwardedFrom && <p className="small" style={{ marginTop: 14 }}>You passed this on from what <Link href={`/c/${d.forwardedFrom.campaignId}`}>{d.forwardedFrom.patient}&apos;s bill</Link> didn&apos;t need.</p>}
      {offer && <div style={{ marginTop: 18 }}><OfferCard offer={offer} covered={offer.status === "declined" && d.offer?.status === "open"} campaignId={c.id} donationId={d.id} fromPatient={c.patient.displayName} currency={c.currency} /></div>}
      <p className="tiny muted" style={{ marginTop: 14 }}>No money from this pledge was paid to the family or the campaign organizer.</p>
    </div>
  );
}
