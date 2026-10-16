"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ResetDemo from "./ResetDemo";

type Item = {
  document: { kind: string; number: string; issuer: string };
  original: { campaignId: string; label: string; status: string; at: string };
  copies: { campaignId: string; label: string; status: string; at: string; sameFile: boolean; samePicture?: boolean }[];
};

const KIND: Record<string, string> = { estimate: "Estimate", identity: "Registration card", medical_note: "Clinical note", final_bill: "Final bill", receipt: "Receipt" };
const STATUS: Record<string, [string, string]> = {
  live: ["Live", "paid"], settled: ["Bill paid", "paid"], needs_review: ["On hold", "warn"], rejected: ["Rejected", "fail"], bill_review: ["Checking bill", "held"],
  bill_needs_review: ["Bill on hold", "warn"], settling: ["Paying", "held"], cancelled: ["Cancelled", ""], verifying: ["Checking", "held"],
};
const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

// Every document seen in more than one campaign. Refreshes every few seconds so it can
// stay open on a second screen during the demo.
export default function Radar() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [space, setSpace] = useState<"main" | "demo">("main");
  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/radar", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (alive) { setItems(j.items); setSpace(j.space); } });
    load();
    const t = setInterval(load, 4000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <div className="wrap" style={{ maxWidth: 940 }}>
      <div className="page-head">
        <div>
          <h1>Reuse radar</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Every hospital document Earmark has ever read is fingerprinted. When the same file, or the same document number, turns up in another campaign, it appears here and that campaign is held.
          </p>
        </div>
        <div className="row">
          <span className="pill held"><span className="dot" style={{ background: "var(--held)" }} /> Live{space === "demo" ? " · your demo" : ""}</span>
          {space === "demo" && <ResetDemo />}
        </div>
      </div>
      {!items ? (
        <span className="thinking"><span className="spinner" /> Loading</span>
      ) : items.length === 0 ? (
        <div className="card"><p><strong>No reused documents yet.</strong> Open the demo campaigns from the home page; Leo&apos;s and the copycat both reuse Maya&apos;s estimate.</p></div>
      ) : (
        <ol className="radar">
          {items.map((it, i) => (
            <li key={i} className="card">
              <div className="radar-head">
                <div>
                  <b>{KIND[it.document.kind] ?? "Document"} {it.document.number}</b>
                  <div className="tiny muted">{it.document.issuer}</div>
                </div>
                <span className="pill fail">In {it.copies.length + 1} campaigns</span>
              </div>
              <ol className="trail">
                <li className="orig">
                  <span className="tiny muted">First seen {when(it.original.at)}</span>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <Link href={`/c/${it.original.campaignId}?role=reviewer`}>{it.original.label}</Link>
                    <span className={`pill ${STATUS[it.original.status]?.[1] ?? ""}`}>{STATUS[it.original.status]?.[0] ?? it.original.status}</span>
                  </div>
                </li>
                {it.copies.map((c) => (
                  <li key={c.campaignId} className="copy">
                    <span className="tiny muted">{c.sameFile ? "Same file" : c.samePicture ? "Re-saved copy of the same page" : "Same document number"} uploaded {when(c.at)}</span>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <Link href={`/c/${c.campaignId}?role=reviewer`}>{c.label}</Link>
                      <span className={`pill ${STATUS[c.status]?.[1] ?? ""}`}>{STATUS[c.status]?.[0] ?? c.status}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
