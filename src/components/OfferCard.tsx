"use client";
import { useState } from "react";
import Link from "next/link";
import type { SurplusOffer } from "@/lib/types";

const money = (v: number | string, c = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(Number(v));

// "Pass it on": shown on a receipt only if the donor asked for it when pledging. Accepting opens
// a NEW PayPal hold for the other patient; declining (or doing nothing) changes nothing.
export default function OfferCard({ offer, campaignId, donationId, fromPatient, currency, covered = false }: { offer: SurplusOffer; campaignId: string; donationId: string; fromPatient: string; currency: string; covered?: boolean }) {
  const [status, setStatus] = useState(offer.status);
  const [busy, setBusy] = useState(false);
  const expired = status === "open" && Date.parse(offer.expiresAt) <= Date.now();
  const first = offer.patient.split(" ")[0];

  if (status === "accepted") return <div className="card offer"><p className="small"><strong>You passed it on.</strong> Your new pledge for {offer.patient} is held on PayPal, and charged only when {first}&apos;s bill is verified.</p><Link className="btn ghost sm" href={`/c/${offer.campaignId}`} style={{ marginTop: 10 }}>See {first}&apos;s campaign</Link></div>;
  if (covered) return <div className="card offer"><p className="small"><strong>{offer.patient}&apos;s bill is now fully pledged</strong> by other donors. Your {money(offer.amount, currency)} stays released: it was never charged.</p></div>;
  if (status === "declined") return <div className="card offer"><p className="small muted">No problem. The {money(offer.amount, currency)} stays released: it was never charged.</p></div>;
  if (expired) return <div className="card offer"><p className="small muted">The offer to help {offer.patient} has closed. Your {money(offer.amount, currency)} stays released: it was never charged.</p></div>;

  const href = `/c/${offer.campaignId}?give=${offer.amount}&from=${campaignId}.${donationId}&for=${encodeURIComponent(fromPatient)}`;
  return (
    <div className="card offer">
      <h3>Pass it on?</h3>
      <p className="small">
        You asked to be offered another patient. <strong>{offer.patient}</strong>&apos;s bill at {offer.hospital} is verified and still needs <b className="num">{money(offer.needs, currency)}</b>.
      </p>
      <div className="row" style={{ marginTop: 12 }}>
        <Link className="btn paid sm" href={href}>Give up to {money(offer.amount, currency)} to {first}</Link>
        <button
          className="btn ghost sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await fetch(`/api/campaigns/${campaignId}/action`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "offer_decline", donationId }) });
            setBusy(false);
            if (r.ok) setStatus("declined");
          }}
        >
          No thanks
        </button>
      </div>
      <p className="tiny muted" style={{ marginTop: 10 }}>
        Opens PayPal for a new hold. You&apos;re charged only if {first}&apos;s final bill is verified. Offer closes {new Date(offer.expiresAt).toLocaleDateString([], { day: "numeric", month: "short" })}.
      </p>
    </div>
  );
}
