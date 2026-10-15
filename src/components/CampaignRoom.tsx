"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { CampaignView } from "@/lib/views";
import type { Check, Role, QA } from "@/lib/types";
import PayPalHold from "./PayPalHold";
import Receipt from "./Receipt";

type Status = { paypal: "sandbox" | "mock"; paypalClientId: string | null; ai: string; model: string };

const money = (v: number | string, c = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(Number(v));
const cents = (v?: string | number) => Math.round(Number(v ?? 0) * 100);

const STATUS: Record<string, [string, string]> = {
  verifying: ["Checking documents", "held"],
  needs_review: ["Waiting for a reviewer", "warn"],
  rejected: ["Rejected", "fail"],
  live: ["Accepting pledges", "paid"],
  bill_review: ["Checking the final bill", "held"],
  bill_needs_review: ["Bill waiting for a reviewer", "warn"],
  settling: ["Paying the hospital", "held"],
  settled: ["Bill paid", "paid"],
  cancelled: ["Cancelled", ""],
};

const ROLES: [Role, string][] = [["donor", "Donor"], ["organizer", "Family"], ["hospital", "Hospital"], ["reviewer", "Reviewer"]];

export default function CampaignRoom({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const role = (["organizer", "hospital", "reviewer"].includes(params.get("role") ?? "") ? params.get("role") : "donor") as Role;
  const [c, setC] = useState<CampaignView | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [err, setErr] = useState("");
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    const r = await fetch(`/api/campaigns/${id}?role=${role}`, { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) setErr(j.error);
    else setC(j);
  }, [id, role]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch("/api/status").then((r) => r.json()).then(setStatus); }, []);
  useEffect(() => { if (c) firstLoad.current = false; }, [c]);

  const act = useCallback(
    async (body: Record<string, unknown>) => {
      setErr("");
      const r = await fetch(`/api/campaigns/${id}/action?role=${role}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) {
        const msg = (j.details?.[0]?.message ?? j.error) + (j.debugId ? ` (PayPal debug id ${j.debugId})` : "");
        setErr(msg);
        throw new Error(msg);
      }
      if (j && j.id && j.docs) setC(j);
      return j;
    },
    [id, role],
  );

  const totals = useMemo(() => {
    if (!c) return null;
    const live = c.donations.filter((d) => d.status === "held");
    return {
      held: live.reduce((s, d) => s + cents(d.pledged), 0) / 100,
      donors: c.donations.filter((d) => ["held", "captured", "voided"].includes(d.status)).length,
    };
  }, [c]);

  if (err && !c) return <div className="wrap" style={{ padding: "40px 0" }}><div className="error">{err}</div></div>;
  if (!c || !totals) return <div className="wrap" style={{ padding: "40px 0" }}><span className="thinking"><span className="spinner" /> Loading the campaign</span></div>;

  const [label, tone] = STATUS[c.status] ?? [c.status, ""];
  const hosp = c.provider?.name ?? "the hospital";
  const goal = Number(c.goal);

  return (
    <div className="wrap">
      <div className="c-head">
        <div>
          <h1>{c.title}</h1>
          <div className="c-sub">
            <span className={`pill ${tone}`}>{label}</span>
            <span>For {c.patient.displayName}{c.patient.age != null ? `, ${c.patient.age}` : ""}</span>
            <span>Organised by {c.organizer.name} ({c.organizer.relationship.toLowerCase()})</span>
            <span>Pays only {hosp}{c.provider ? `, ${c.provider.city}` : ""}</span>
          </div>
        </div>
        <div className="seg" role="group" aria-label="View as">
          {ROLES.map(([r, l]) => (
            <button key={r} aria-pressed={role === r} onClick={() => router.replace(`/c/${id}?role=${r}`, { scroll: false })}>{l}</button>
          ))}
        </div>
      </div>

      <div className="layout">
        <div>
          {err && <div className="error" role="alert" style={{ marginBottom: 14 }}>{err}</div>}

          {c.settlement && <Settlement c={c} hosp={hosp} />}
          {c.billReview && <BillReviewSection c={c} />}

          <section className="section" aria-labelledby="verif" style={{ marginTop: c.settlement || c.billReview ? 28 : 6 }}>
            <h2 id="verif">Document check</h2>
            <Verdict c={c} animate={firstLoad.current} />
            <CheckList checks={c.verification?.checks ?? []} animate={firstLoad.current} />
          </section>

          {c.facts.length > 0 && (
            <section className="section" aria-labelledby="facts">
              <h2 id="facts">Verified facts</h2>
              <ul className="facts">{c.facts.map((f, i) => <li key={i}>{f}</li>)}</ul>
            </section>
          )}

          {c.story && (
            <section className="section" aria-labelledby="story">
              <h2 id="story">In {c.organizer.name.split(" ")[0]}&apos;s words</h2>
              <p className="tiny muted" style={{ marginBottom: 8 }}>Written by the family. Earmark verifies the documents, not the story.</p>
              <p className="story">{c.story}</p>
            </section>
          )}

          {role !== "donor" && c.docs.length > 0 && (
            <section className="section" aria-labelledby="docs">
              <h2 id="docs">Documents</h2>
              <p className="tiny muted" style={{ marginBottom: 10 }}>Only the family, the hospital and reviewers can see these. Donors see the checks, not the documents.</p>
              <div className="docs">
                {c.docs.map((d) => (
                  <a key={d.id} className="doc-tile" href={`/api/docs/${c.id}/${d.id}?role=${role}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {d.mime.startsWith("image/") ? <img src={`/api/docs/${c.id}/${d.id}?role=${role}`} alt={`${d.kind} document`} /> : <div style={{ height: 170, display: "grid", placeItems: "center" }}>PDF</div>}
                    <div><b>{{ estimate: "Estimate", identity: "Registration card", medical_note: "Clinical note", final_bill: "Final bill" }[d.kind]}</b>Read by {d.readerModel ?? "—"}</div>
                  </a>
                ))}
              </div>
            </section>
          )}

          <section className="section" aria-labelledby="tl">
            <h2 id="tl">Timeline</h2>
            <ol className="timeline">
              {[...c.events].reverse().map((e) => (
                <li key={e.id} className={e.actor}>
                  <time dateTime={e.at}>{new Date(e.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time>
                  {e.message}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="side">
          <MoneyCard c={c} held={totals.held} donors={totals.donors} goal={goal} />
          {role === "donor" && <DonatePanel c={c} status={status} act={act} reload={load} />}
          {role === "hospital" && <HospitalPanel c={c} hosp={hosp} onDone={setC} act={act} />}
          {role === "reviewer" && <ReviewerPanel c={c} act={act} />}
          {role === "organizer" && <OrganizerPanel c={c} act={act} />}
          {c.status !== "rejected" && c.facts.length > 0 && <AskPanel act={act} />}
          <DonorList c={c} />
        </aside>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────

function Verdict({ c, animate }: { c: CampaignView; animate: boolean }) {
  const v = c.verification;
  if (!v) return <div className="verdict"><span className="thinking"><span className="spinner" /> Reading the documents</span></div>;
  const fails = v.checks.filter((k) => k.status === "fail").length;
  const stamp =
    v.decision === "verified" ? { t: "Verified", s: `${v.checks.length} checks`, k: "paid" }
    : v.decision === "rejected" ? { t: "Rejected", s: `${fails} checks failed`, k: "fail" }
    : { t: "In review", s: "a person decides", k: "warn" };
  return (
    <div className={`verdict ${v.decision}`}>
      <div>
        <p><strong>{v.decision === "rejected" ? "This campaign failed verification." : v.decision === "verified" ? "The documents check out." : "A reviewer needs to look at this."}</strong> {v.summary}</p>
        {c.reviewerNote && <p className="small muted" style={{ marginTop: 6 }}>Reviewer: {c.reviewerNote}</p>}
      </div>
      <span className={`stamp ${stamp.k} ${animate ? "land" : ""}`}>{stamp.t}<small>{stamp.s}</small></span>
    </div>
  );
}

function CheckList({ checks, animate }: { checks: Check[]; animate: boolean }) {
  const order = { fail: 0, warn: 1, pass: 2 } as const;
  const sorted = [...checks].sort((a, b) => order[a.status] - order[b.status]);
  return (
    <ul className="checks">
      {sorted.map((k, i) => (
        <li key={k.id + i} className={`${k.status} ${animate ? "reveal" : ""}`} style={animate ? { animationDelay: `${i * 70}ms` } : undefined}>
          <span className={`mark ${k.status}`} aria-label={k.status}>{k.status === "pass" ? "✓" : k.status === "fail" ? "✕" : "!"}</span>
          <div><div className="lbl">{k.label}</div><div className="ev">{k.detail}</div></div>
          <span className="src">{k.source === "ai" ? "AI reading" : "Rule"}</span>
        </li>
      ))}
    </ul>
  );
}

function MoneyCard({ c, held, donors, goal }: { c: CampaignView; held: number; donors: number; goal: number }) {
  const cur = c.currency;
  if (c.status === "rejected") {
    return (
      <div className="card money">
        <h3>No donations possible</h3>
        <p className="small">This campaign failed verification, so it can&apos;t take pledges and nobody can be charged for it.</p>
      </div>
    );
  }
  if (c.settlement) {
    const s = c.settlement;
    return (
      <div className="card money">
        <h3>Bill paid</h3>
        <div className="goal"><b>{money(s.captured, cur)}</b><span className="muted small">paid to {c.provider?.name}</span></div>
        <div className="bar" aria-hidden="true">
          <span style={{ width: `${(Number(s.captured) / Math.max(1, Number(s.captured) + Number(s.neverCharged))) * 100}%`, background: "var(--paid)" }} />
          <span style={{ width: `${(Number(s.neverCharged) / Math.max(1, Number(s.captured) + Number(s.neverCharged))) * 100}%`, background: "var(--never-fill)" }} />
        </div>
        <p className="small"><b className="num">{money(s.neverCharged, cur)}</b> of pledges was never charged.</p>
      </div>
    );
  }
  const pct = goal ? Math.min(100, (held / goal) * 100) : 0;
  return (
    <div className="card money">
      <h3>Verified goal</h3>
      <div className="goal"><b>{money(goal, cur)}</b><span className="muted small">{donors} donor{donors === 1 ? "" : "s"}</span></div>
      <div className="bar" aria-hidden="true"><span style={{ width: `${pct}%`, background: "var(--held)" }} /></div>
      <p className="small"><b className="num">{money(held, cur)}</b> pledged and held on PayPal. Nobody has been charged yet.</p>
    </div>
  );
}

function DonatePanel({ c, status, act, reload }: { c: CampaignView; status: Status | null; act: (b: Record<string, unknown>) => Promise<unknown>; reload: () => Promise<void> }) {
  const [amount, setAmount] = useState("50");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [anon, setAnon] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const donation = useRef<string>("");
  const cur = c.currency;

  if (c.status !== "live") {
    const why = {
      needs_review: "A reviewer is checking this campaign. Pledges open if it's approved.",
      verifying: "The documents are being checked.",
      bill_review: "The final bill is being checked. Pledges are closed.",
      bill_needs_review: "A reviewer is checking the final bill. Pledges are closed.",
      settling: "The hospital is being paid.",
      settled: "The bill has been paid. Thank you to everyone who pledged.",
      cancelled: "The family cancelled this campaign. Every pledge was released.",
      rejected: "",
    }[c.status as string];
    return why ? <div className="card"><p className="small">{why}</p></div> : null;
  }

  const valid = /^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) >= 1 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  return (
    <div className="card">
      <h3>Pledge</h3>
      {done ? (
        <div className="stack">
          <p className="small"><strong>Thank you{name ? `, ${name.split(" ")[0]}` : ""}.</strong> {money(done, cur)} is held on your PayPal. You&apos;ll only be charged your share of the verified bill, and it goes straight to {c.provider?.name}.</p>
          <button className="btn ghost sm" onClick={() => { setDone(null); setMsg(""); }}>Pledge again</button>
        </div>
      ) : (
        <div className="stack">
          <div className="amounts" role="group" aria-label="Amount">
            {["25", "50", "100", "250"].map((a) => (
              <button key={a} aria-pressed={amount === a} onClick={() => setAmount(a)}>{money(a, cur).replace(".00", "")}</button>
            ))}
          </div>
          <label className="field">Amount ({cur})<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.trim())} /></label>
          <div className="two">
            <label className="field">Your name<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
            <label className="field">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          </div>
          <label className="field">Message (optional)<input value={msg} maxLength={280} onChange={(e) => setMsg(e.target.value)} /></label>
          <label className="check-line"><input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} /> Show my pledge as anonymous</label>
          <p className="tiny muted">PayPal holds your pledge; you&apos;re not charged now. If the campaign is cancelled or the bill is smaller, the rest is released.</p>
          {valid && status ? (
            <PayPalHold
              mode={status.paypal}
              clientId={status.paypalClientId}
              currency={cur}
              amountLabel={money(amount, cur)}
              createOrder={async () => {
                const r = (await act({ action: "donate_create", donorName: name || "A friend", donorEmail: email, amount, anonymous: anon, message: msg })) as { orderId: string; donationId: string };
                donation.current = r.donationId;
                return r.orderId;
              }}
              confirm={async (orderId) => {
                await act({ action: "donate_confirm", donationId: donation.current, orderId });
                setDone(amount);
              }}
            />
          ) : (
            <p className="tiny muted">Enter an amount and your email to continue with PayPal.</p>
          )}
          {status?.paypal === "mock" && (
            <button className="btn ghost sm" disabled={busy} onClick={async () => { setBusy(true); try { await act({ action: "simulate_donors" }); await reload(); } finally { setBusy(false); } }}>
              {busy ? "Adding donors…" : "Add 8 simulated donors (mock mode)"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function HospitalPanel({ c, hosp, onDone, act }: { c: CampaignView; hosp: string; onDone: (c: CampaignView) => void; act: (b: Record<string, unknown>) => Promise<unknown> }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const isMaya = c.docs.some((d) => d.filename === "maya-estimate.png");

  async function submit(f: File) {
    setBusy(true);
    setErr("");
    const fd = new FormData();
    fd.append("bill", f);
    const r = await fetch(`/api/campaigns/${c.id}/bill`, { method: "POST", body: fd });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setErr(j.error); return; }
    onDone(j);
  }

  if (c.status === "settled" && c.settlement?.payoutStatus === "FAILED") {
    return (
      <div className="card">
        <h3>Payout failed</h3>
        <p className="small">Donations were collected, but the transfer to {hosp}&apos;s PayPal failed. The money is safe.</p>
        <button className="btn sm" style={{ marginTop: 10 }} onClick={() => act({ action: "retry_payout" })}>Retry payout</button>
      </div>
    );
  }
  if (c.status !== "live" && c.status !== "bill_needs_review") {
    return <div className="card"><h3>{hosp} billing</h3><p className="small">{c.status === "settled" ? `Paid ${money(c.settlement!.captured, c.currency)} to your registered PayPal account.` : "Nothing to do right now."}</p></div>;
  }
  return (
    <div className="card">
      <h3>Submit the final bill</h3>
      <p className="small muted" style={{ marginBottom: 12 }}>Signed in as {hosp} billing. The bill is checked against the verified estimate, and payment goes to your registered PayPal account.</p>
      <div className="stack">
        <label className="field">Final invoice (PDF or photo)<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <div className="row">
          <button className="btn sm" disabled={!file || busy} onClick={() => file && submit(file)}>{busy ? "Checking the bill…" : "Submit bill"}</button>
          {isMaya && (
            <button className="btn ghost sm" disabled={busy} onClick={async () => { const b = await (await fetch("/samples/maya-final-bill.png")).blob(); await submit(new File([b], "maya-final-bill.png", { type: "image/png" })); }}>
              Use the sample final bill
            </button>
          )}
        </div>
        {busy && <span className="thinking"><span className="spinner" /> Reading the bill and comparing it with the estimate</span>}
        {err && <div className="error">{err}</div>}
      </div>
    </div>
  );
}

function ReviewerPanel({ c, act }: { c: CampaignView; act: (b: Record<string, unknown>) => Promise<unknown> }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const which = c.status === "needs_review" ? "review_campaign" : c.status === "bill_needs_review" ? "review_bill" : null;
  if (!which) return <div className="card"><h3>Reviewer</h3><p className="small">Nothing needs a decision on this campaign.</p></div>;
  const run = async (approve: boolean) => { setBusy(true); try { await act({ action: which, approve, note }); } catch { /* shown */ } finally { setBusy(false); } };
  return (
    <div className="card">
      <h3>{which === "review_campaign" ? "Approve this campaign?" : "Approve this bill?"}</h3>
      <p className="small muted" style={{ marginBottom: 12 }}>Read the failed and flagged checks, open the documents, and call the hospital if needed.</p>
      <label className="field">Note for the timeline<textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Confirmed with the hospital's billing office by phone" /></label>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn paid sm" disabled={busy} onClick={() => run(true)}>Approve</button>
        <button className="btn danger sm" disabled={busy} onClick={() => run(false)}>Reject</button>
      </div>
    </div>
  );
}

function OrganizerPanel({ c, act }: { c: CampaignView; act: (b: Record<string, unknown>) => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const can = ["live", "needs_review", "bill_needs_review"].includes(c.status);
  return (
    <div className="card">
      <h3>Your campaign</h3>
      <p className="small">Share this page. Money raised can only be paid to {c.provider?.name}, against the final bill. You never need to handle it.</p>
      {can && (
        <button className="btn danger sm" style={{ marginTop: 12 }} disabled={busy} onClick={async () => { setBusy(true); try { await act({ action: "cancel", reason: "Cancelled by the family" }); } catch { /* shown */ } finally { setBusy(false); } }}>
          {busy ? "Cancelling…" : "Cancel and release every pledge"}
        </button>
      )}
    </div>
  );
}

function AskPanel({ act }: { act: (b: Record<string, unknown>) => Promise<unknown> }) {
  const [q, setQ] = useState("");
  const [a, setA] = useState<QA | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="card">
      <h3>Ask about this campaign</h3>
      <form className="stack" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { setA((await act({ action: "ask", question: q })) as QA); } catch { /* shown */ } finally { setBusy(false); } }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Where does my money go if the bill is smaller?" aria-label="Question" />
        <button className="btn ghost sm" disabled={busy || q.trim().length < 3}>{busy ? "Checking…" : "Ask"}</button>
        {a && <div className="qa-answer">{a.answer}<div className="tiny muted" style={{ marginTop: 6 }}>Answered from verified facts only · {a.model}</div></div>}
      </form>
    </div>
  );
}

function DonorList({ c }: { c: CampaignView }) {
  const ds = c.donations.filter((d) => ["held", "captured", "voided"].includes(d.status)).slice().reverse();
  if (!ds.length) return null;
  return (
    <div className="card">
      <h3>Pledges</h3>
      <ul className="donors">
        {ds.slice(0, 12).map((d) => (
          <li key={d.id}>
            <div>{d.donorName}{d.message && <div className="msg">{d.message}</div>}</div>
            <div style={{ textAlign: "right" }}>
              <b className="num">{money(d.pledged, c.currency)}</b>
              <div className="tiny">
                {d.status === "held" ? <span className="pill held">Held</span> : (
                  <Link href={`/c/${c.id}/receipt/${d.id}`}>Receipt</Link>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BillReviewSection({ c }: { c: CampaignView }) {
  const b = c.billReview!;
  const cur = c.currency;
  const excluded = b.lines.filter((l) => !l.covered).reduce((s, l) => s + l.amount, 0);
  return (
    <section className="section" aria-labelledby="bill" style={{ marginTop: 6 }}>
      <h2 id="bill">Final bill</h2>
      <p style={{ marginBottom: 12 }}>{b.explanation}</p>
      <div className="table-scroll"><table className="lines">
        <thead><tr><th>Charge</th><th className="n">Estimate</th><th className="n">Billed</th><th>Paid by donations?</th></tr></thead>
        <tbody>
          {b.lines.map((l, i) => (
            <tr key={i} className={l.covered ? "" : "excluded"}>
              <td>{l.description}</td>
              <td className="n">{l.estimateAmount == null ? "—" : money(l.estimateAmount, cur)}</td>
              <td className="n">{money(l.amount, cur)}</td>
              <td>{l.covered ? "Yes" : `No: ${l.reason}`}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td>Payable from donations</td><td className="n">{money(c.goal, cur)}</td><td className="n">{money(b.payable, cur)}</td><td className="tiny">{excluded ? `${money(excluded, cur)} excluded` : ""}</td></tr>
        </tfoot>
      </table></div>
      <div style={{ marginTop: 12 }}><CheckList checks={b.checks.filter((k) => k.status !== "pass")} animate={false} /></div>
      <p className="tiny muted" style={{ marginTop: 8 }}>Bill lines classified by {b.model}. Every other bill check passed.</p>
    </section>
  );
}

function Settlement({ c, hosp }: { c: CampaignView; hosp: string }) {
  const s = c.settlement!;
  const best = c.donations.filter((d) => d.status === "captured").sort((a, b) => Number(b.pledged) - Number(a.pledged))[0];
  return (
    <section className="section" aria-labelledby="settle" style={{ marginTop: 6 }}>
      <h2 id="settle">Where the money went</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, alignItems: "start" }}>
        <div className="card">
          <div className="legend" style={{ marginTop: 0 }}>
            <div><i style={{ background: "var(--paid)" }} /><span>Paid directly to {hosp}</span><b>{money(s.captured, c.currency)}</b></div>
            <div><i style={{ background: "var(--never-fill)" }} /><span>Never charged to donors</span><b>{money(s.neverCharged, c.currency)}</b></div>
            <div><i style={{ background: "var(--muted)" }} /><span>Paid to the family</span><b>{money(0, c.currency)}</b></div>
          </div>
          <p className="tiny muted" style={{ marginTop: 12 }}>
            Every donor paid the same {Math.round((Number(s.captured) / Math.max(0.01, Number(s.captured) + Number(s.neverCharged))) * 1000) / 10}% of their pledge.
            {s.payoutBatchId && <> PayPal payout {s.payoutBatchId} ({s.payoutStatus?.toLowerCase()}).</>}
          </p>
        </div>
        {best && <Receipt donor={best.donorName} pledged={Number(best.pledged)} paid={Number(best.captured)} hospital={hosp} patient={c.patient.displayName} currency={c.currency} />}
      </div>
    </section>
  );
}
