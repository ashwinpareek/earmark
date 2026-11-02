"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PayPalHold from "./PayPalHold";

type Gift = { campaignId: string; donationId: string; patient: string; amount: string; reason: string; authorizationId?: string; at: string; by: "donor" | "agent" };
type Mandate = { id: string; donorName: string; donorEmail: string; limitCents: number; perGiftCents: number; cause: string; status: "draft" | "active" | "revoked"; hasPayPal: boolean; spent: string; remaining: string; gifts: Gift[] };
type Entry = { id: string; patient: string; age: number | null; hospital: string; city: string; procedure: string; goal: string; held: string; stillNeeds: string; checksPassed: number; checksTotal: number };
type Ev =
  | { kind: "think"; text: string }
  | { kind: "tool"; name: string; label: string }
  | { kind: "gift"; patient: string; amount: string; authorizationId: string; campaignId: string; reason: string }
  | { kind: "refused"; why: string }
  | { kind: "approval"; campaignId: string; patient: string; amount: string; reason: string }
  | { kind: "final"; text: string; model: string };
type Turn = { ask: string; events: Ev[]; shown: number };

const usd = (v: string | number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v));
const IDEAS = ["Give $40 to a child who needs surgery", "Help someone recovering from burns", "Give $25 to whoever is closest to their goal"];

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? "Something went wrong");
  return j as T;
}

export default function GivingAgent() {
  const [m, setM] = useState<Mandate | null>(null);
  const [cat, setCat] = useState<Entry[]>([]);
  const [pp, setPp] = useState<{ mode: "sandbox" | "mock"; clientId: string | null }>({ mode: "mock", clientId: null });
  const [loaded, setLoaded] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    const j = await (await fetch("/api/agent", { cache: "no-store" })).json();
    setM(j.mandate); setCat(j.catalog ?? []);
  };
  useEffect(() => {
    Promise.all([refresh(), fetch("/api/status").then((r) => r.json()).then((s) => setPp({ mode: s.paypal === "sandbox" ? "sandbox" : "mock", clientId: s.paypalClientId ?? null }))])
      .catch((e) => setErr((e as Error).message)).finally(() => setLoaded(true));
  }, []);

  // Reveal each agent step in turn, so the reasoning reads like it happened.
  useEffect(() => {
    const t = turns.findIndex((x) => x.shown < x.events.length);
    if (t < 0) return;
    const id = setTimeout(() => setTurns((ts) => ts.map((x, i) => (i === t ? { ...x, shown: x.shown + 1 } : x))), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 420);
    return () => clearTimeout(id);
  }, [turns]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [turns]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true); setErr("");
    setTurns((ts) => [...ts, { ask: text, events: [], shown: 0 }]);
    setAsk("");
    try {
      const j = await post<{ events: Ev[]; mandate: Mandate }>("/api/agent", { message: text });
      setTurns((ts) => ts.map((x, i) => (i === ts.length - 1 ? { ...x, events: j.events } : x)));
      setM(j.mandate);
      refresh().catch(() => undefined);
    } catch (e) {
      setErr((e as Error).message);
      setTurns((ts) => ts.slice(0, -1));
    } finally { setBusy(false); }
  };

  if (!loaded) return <div className="ga-loading"><span className="spinner" /> Waking your agent…</div>;

  return (
    <div className="ga">
      <aside className="ga-side">
        {!m || m.status === "revoked" ? <MandateForm onSaved={(x) => setM(x)} /> : <MandateCard m={m} onChange={refresh} />}
        <div className="ga-cat">
          <h3>Verified families it can choose from</h3>
          <ul>
            {cat.map((c) => {
              const pct = Math.min(100, (Number(c.held) / Number(c.goal)) * 100);
              return (
                <li key={c.id}>
                  <Link href={`/c/${c.id}?role=donor`}>
                    <span className="ga-cat-top"><b>{c.patient}{c.age !== null ? `, ${c.age}` : ""}</b><span className="ok">{c.checksPassed}/{c.checksTotal} checks</span></span>
                    <span className="muted">{c.procedure || "Hospital care"} · {c.hospital}</span>
                    <span className="ga-bar"><i style={{ width: `${pct}%` }} /></span>
                    <span className="muted tiny">{usd(c.held)} held of {usd(c.goal)}</span>
                  </Link>
                </li>
              );
            })}
            {!cat.length && <li className="muted">Verifying the catalog… refresh in a few seconds.</li>}
          </ul>
        </div>
      </aside>

      <section className="ga-main" aria-label="Your agent">
        <div className="ga-log" aria-live="polite">
          {!turns.length && (
            <div className="ga-empty">
              <p className="ga-empty-h">Tell your agent what you&apos;d like to do.</p>
              <p className="muted">It searches verified campaigns, reads the hospital evidence, and gives within your limits. Every gift is a PayPal hold: it can only ever pay a bill the hospital confirms.</p>
            </div>
          )}
          {turns.map((t, ti) => (
            <div key={ti} className="ga-turn">
              <p className="ga-ask">{t.ask}</p>
              <ol className="ga-steps">
                {t.events.slice(0, t.shown).map((e, i) => <Step key={i} e={e} pp={pp} m={m} onDone={refresh} />)}
                {(busy && ti === turns.length - 1) || t.shown < t.events.length ? <li className="ga-step pending"><span className="ga-ico"><span className="spinner" /></span><span>{t.events.length ? "…" : "Thinking with Gemini…"}</span></li> : null}
              </ol>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        {err && <div className="error" role="alert">{err}</div>}
        <form className="ga-input" onSubmit={(e) => { e.preventDefault(); send(ask); }}>
          <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder={m ? "e.g. Give $40 to a child who needs surgery" : "Set your limits first"} disabled={!m || m.status === "revoked" || busy} aria-label="Ask your agent" maxLength={600} />
          <button className="btn warm" disabled={!m || m.status === "revoked" || busy || !ask.trim()}>{busy ? "Working…" : "Ask"}</button>
        </form>
        {m && m.status !== "revoked" && (
          <div className="ga-ideas">{IDEAS.map((i) => <button key={i} type="button" className="chip" onClick={() => send(i)} disabled={busy}>{i}</button>)}</div>
        )}
      </section>
    </div>
  );
}

function Step({ e, pp, m, onDone }: { e: Ev; pp: { mode: "sandbox" | "mock"; clientId: string | null }; m: Mandate | null; onDone: () => Promise<void> }) {
  const [approved, setApproved] = useState(false);
  if (e.kind === "tool") return <li className="ga-step"><span className="ga-ico tool" aria-hidden="true" /><span>{e.label}</span></li>;
  if (e.kind === "think") return <li className="ga-step think"><span className="ga-ico think" aria-hidden="true" /><span>{e.text}</span></li>;
  if (e.kind === "refused") return <li className="ga-step refused"><span className="ga-ico no" aria-hidden="true" /><span><b>Blocked by your mandate:</b> {e.why}</span></li>;
  if (e.kind === "gift") return (
    <li className="ga-step gift">
      <span className="ga-ico yes" aria-hidden="true" />
      <span className="ga-gift">
        <b>{usd(e.amount)} held for {e.patient}</b>
        <span>{e.reason}</span>
        <span className="tiny muted">PayPal authorization <code>{e.authorizationId}</code> · placed by your agent, nothing charged</span>
      </span>
    </li>
  );
  if (e.kind === "approval") return (
    <li className="ga-step approval">
      <span className="ga-ico pp" aria-hidden="true" />
      <span className="ga-approve">
        <b>Approve {usd(e.amount)} for {e.patient}</b>
        <span>{e.reason}</span>
        <span className="tiny muted">This also saves your PayPal for your agent, so it can place future gifts within your {m ? usd(m.limitCents / 100) : ""} limit without asking. You can revoke it any time.</span>
        {approved ? <span className="ok">Approved. Your agent is now active.</span> : (
          <PayPalHold
            paypalOnly
            mode={pp.mode}
            clientId={pp.clientId}
            currency="USD"
            amountLabel={usd(e.amount)}
            createOrder={async () => (await post<{ orderId: string; donationId: string }>("/api/agent/approve", { campaignId: e.campaignId, amount: e.amount }).then((r) => { (window as unknown as { __gaDon: string }).__gaDon = r.donationId; return r.orderId; }))}
            confirm={async (orderId) => {
              await post("/api/agent/confirm", { campaignId: e.campaignId, donationId: (window as unknown as { __gaDon: string }).__gaDon, orderId, reason: e.reason });
              setApproved(true);
              await onDone();
            }}
          />
        )}
      </span>
    </li>
  );
  return <li className="ga-step final"><span className="ga-ico agent" aria-hidden="true" /><span><span>{e.text}</span><span className="tiny muted">Giving Agent · {e.model}</span></span></li>;
}

function MandateForm({ onSaved }: { onSaved: (m: Mandate) => void }) {
  const [f, setF] = useState({ donorName: "", donorEmail: "", limit: "100", perGift: "40", cause: "Children who need surgery" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form className="ga-mandate card" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr("");
      try { onSaved(await post<Mandate>("/api/agent/mandate", { ...f, limit: Number(f.limit), perGift: Number(f.perGift) })); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
    }}>
      <h3>Your mandate</h3>
      <p className="muted small">The rules your agent can never break. They&apos;re enforced by code, not by asking the AI nicely.</p>
      <label>What you care about<input value={f.cause} onChange={(e) => setF({ ...f, cause: e.target.value })} maxLength={200} /></label>
      <div className="two">
        <label>Total limit (USD)<input inputMode="decimal" value={f.limit} onChange={(e) => setF({ ...f, limit: e.target.value })} /></label>
        <label>Most per gift<input inputMode="decimal" value={f.perGift} onChange={(e) => setF({ ...f, perGift: e.target.value })} /></label>
      </div>
      <div className="two">
        <label>Your name<input value={f.donorName} onChange={(e) => setF({ ...f, donorName: e.target.value })} maxLength={80} /></label>
        <label>Email<input type="email" value={f.donorEmail} onChange={(e) => setF({ ...f, donorEmail: e.target.value })} /></label>
      </div>
      <ul className="ga-rules">
        <li>Only campaigns that passed every check</li>
        <li>One gift per family, never above your limits</li>
        <li>Every gift is a PayPal hold, paid only to the hospital</li>
      </ul>
      {err && <div className="error">{err}</div>}
      <button className="btn" disabled={busy}>{busy ? "Saving…" : "Save my mandate"}</button>
    </form>
  );
}

function MandateCard({ m, onChange }: { m: Mandate; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const pct = Math.min(100, (Number(m.spent) / (m.limitCents / 100)) * 100);
  return (
    <div className="ga-mandate card">
      <div className="ga-m-top">
        <h3>Your mandate</h3>
        <span className={`ga-status ${m.status}`}>{m.status === "active" ? "Agent active" : "Needs your first approval"}</span>
      </div>
      <p className="ga-cause">“{m.cause}”</p>
      <div className="ga-meter" role="img" aria-label={`${usd(m.spent)} of ${usd(m.limitCents / 100)} used`}><i style={{ width: `${pct}%` }} /></div>
      <p className="small"><b>{usd(m.spent)}</b> held of <b>{usd(m.limitCents / 100)}</b> · up to {usd(m.perGiftCents / 100)} per gift</p>
      <p className="tiny muted">{m.hasPayPal ? "PayPal saved for your agent. The token stays on Earmark's server; your agent never sees it." : "Your first gift is approved in PayPal's own window. That also lets your agent place later gifts."}</p>
      {m.gifts.length > 0 && (
        <ul className="ga-gifts">
          {m.gifts.map((g) => (
            <li key={g.donationId}>
              <span><b>{usd(g.amount)}</b> to {g.patient}</span>
              <span className="tiny muted">{g.by === "agent" ? "by your agent" : "approved by you"} · {g.authorizationId}</span>
            </li>
          ))}
        </ul>
      )}
      <button className="btn ghost sm" disabled={busy} onClick={async () => {
        if (!window.confirm("Stop your agent? Gifts already held stay; it can't place new ones.")) return;
        setBusy(true);
        try { await post("/api/agent/revoke", {}); await onChange(); } finally { setBusy(false); }
      }}>Stop my agent</button>
    </div>
  );
}
