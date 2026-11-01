"use client";
import { useEffect, useRef, useState } from "react";

// "Follow one pledge": the receipt stays pinned while the four chapters scroll past it, and it
// changes as each one arrives. The numbers and IDs are from a real PayPal sandbox run (Nov 1, 2026;
// docs/SANDBOX_RUN.md).

const CHAPTERS = [
  {
    k: "Pledge",
    title: "Mei pledges $2,500. PayPal holds it.",
    body: "It's an authorization on Mei's own PayPal account. Nothing is charged, and nobody can spend it: not the family, not Earmark.",
  },
  {
    k: "Paperwork",
    title: "Gemini reads the hospital's documents. Plain rules decide.",
    body: "The AI transcribes every page. Ten checks verify the hospital, the totals, the patient and every document Earmark has ever seen. A forgery stops here.",
  },
  {
    k: "Confirmation",
    title: "The hospital confirms the final bill.",
    body: "Earmark asks the billing office through its own registry, never the number printed on the paper: did you issue this bill, for this patient, for $2,295?",
  },
  {
    k: "Payment",
    title: "$2,295 goes to the hospital. $205 is never charged.",
    body: "PayPal captures exactly the bill's share and releases the rest of the hold. Payouts sends the money straight to the hospital. The family receives $0.",
  },
];

const TRAIL = [
  { label: "Held on PayPal", id: "9FY23961RB689143T" },
  { label: "10 checks passed", id: "Gemini 3.5 Flash + rules" },
  { label: "Bill confirmed", id: "INV-2026-11504 · $2,295.00" },
  { label: "Paid to Riverside Children's", id: "Payout RW94L5BYXUL5J" },
];

export default function PledgeStory() {
  const [step, setStep] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setStep(Number((e.target as HTMLElement).dataset.i))),
      { rootMargin: "-48% 0px -48% 0px" },
    );
    refs.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, []);
  const paid = step >= 3;
  return (
    <section className="pstory" aria-labelledby="story-h">
      <div className="wrap">
        <div className="story-head">
          <h2 id="story-h">Follow one pledge</h2>
          <p>A real run on the PayPal sandbox, from pledge to payment.</p>
        </div>
        <div className="story-grid">
          <ol className="story-steps">
            {CHAPTERS.map((c, i) => (
              <li key={c.k} data-i={i} ref={(el) => { refs.current[i] = el; }} className={i === step ? "on" : ""}>
                <span className="story-k"><b>{i + 1}</b> {c.k}</span>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </li>
            ))}
          </ol>
          <div className="story-pin">
            <div className="story-rail" aria-hidden="true">{CHAPTERS.map((c, i) => <i key={c.k} className={i <= step ? "on" : ""} />)}</div>
            <div className="story-card grain" aria-live="polite">
              <div className="sc-top">
                <div>
                  <div className="sc-who">Mei pledged for Maya R.</div>
                  <div className="sc-big num">$2,500.00</div>
                </div>
                {paid
                  ? <span className="stamp paid land sc-stamp">PayPal agrees<small>via Agent Toolkit</small></span>
                  : <span className={`sc-state s${step}`}>{["Held", "Checking", "Verified"][step]}</span>}
              </div>
              <div className={`sc-bar ${paid ? "split" : ""} ${step === 1 ? "scan" : ""}`} role="img" aria-label={paid ? "$2,295 paid to the hospital, $205 never charged" : "$2,500 held on PayPal, not charged"}>
                <span className="b-held" />
                <span className="b-paid" />
                <span className="b-never" />
              </div>
              <dl className="sc-legend">
                {paid ? (
                  <>
                    <div><dt><i className="k-paid" />Paid to the hospital</dt><dd className="num">$2,295.00</dd></div>
                    <div><dt><i className="k-never" />Released, never charged</dt><dd className="num">$205.00</dd></div>
                    <div><dt><i className="k-zero" />Family and Earmark</dt><dd className="num">$0.00</dd></div>
                  </>
                ) : (
                  <div><dt><i className="k-held" />Held on PayPal, not charged</dt><dd className="num">$2,500.00</dd></div>
                )}
              </dl>
              <ol className="sc-trail">
                {TRAIL.map((t, i) => (
                  <li key={t.label} className={i <= step ? "on" : ""}>
                    <span className="tick" aria-hidden="true" />
                    <span>{t.label}</span>
                    <code>{t.id}</code>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
