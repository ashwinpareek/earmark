"use client";
import { useState } from "react";
import type { Witness } from "@/lib/witness";

// "Ask PayPal": an independent check of this receipt, answered from PayPal's own records through
// PayPal's Agent Toolkit. Earmark can't edit what PayPal says.
export default function WitnessCheck({ campaignId, donationId }: { campaignId: string; donationId: string }) {
  const [w, setW] = useState<Witness | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="card witness" style={{ marginTop: 18 }}>
      <h3>Don&apos;t trust us. Ask PayPal.</h3>
      <p className="small muted">Checks this receipt against PayPal&apos;s own records, read through PayPal&apos;s Agent Toolkit (read-only).</p>
      {!w && (
        <button className="btn ghost sm" style={{ marginTop: 10 }} disabled={busy} onClick={async () => {
          setBusy(true); setErr("");
          try {
            const r = await fetch(`/api/witness/${campaignId}/${donationId}`, { cache: "no-store" });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error);
            setW(j);
          } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
        }}>
          {busy ? "Asking PayPal…" : "Check with PayPal"}
        </button>
      )}
      {err && <div className="error" style={{ marginTop: 10 }}>{err}</div>}
      {w && (
        <div style={{ marginTop: 10 }}>
          <p className="small"><span className={`pill ${w.source === "mock" ? "" : w.agrees ? "paid" : "fail"}`}>{w.source === "mock" ? "Mock" : w.agrees ? "PayPal agrees" : "Mismatch"}</span> {w.note}</p>
          <div className="table-scroll"><table className="lines" style={{ marginTop: 10 }}>
            <thead><tr><th>Check</th><th>Earmark says</th><th>PayPal says</th><th /></tr></thead>
            <tbody>{w.checked.map((k) => <tr key={k.what}><td>{k.what}</td><td>{k.earmark}</td><td>{k.paypal}</td><td>{k.ok ? "✓" : "✕"}</td></tr>)}</tbody>
          </table></div>
          <p className="tiny muted" style={{ marginTop: 8 }}>Tool: {w.tool} · {w.source === "mock" ? "mock mode" : "@paypal/agent-toolkit, PayPal sandbox"}{w.paypal.captureIds.length ? ` · capture ${w.paypal.captureIds.join(", ")}` : ""}</p>
        </div>
      )}
    </div>
  );
}
