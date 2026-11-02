"use client";
import { useEffect, useState } from "react";

// Hero card: one gift, followed from pledge to payment. It loops gently through three moments.
const STEPS = [
  { k: "Held by PayPal", note: "Grace gives $100. It's a hold on her own PayPal, not a charge." },
  { k: "Bill verified", note: "Riverside Children's confirms the final bill. Gemini and the rules agree." },
  { k: "Paid to the hospital", note: "Grace pays her fair share, $88.27. The other $11.73 is never charged." },
];

export default function HeroReceipt() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setI(2); return; }
    const t = setInterval(() => setI((n) => (n + 1) % STEPS.length), 3400);
    return () => clearInterval(t);
  }, []);
  const paid = i === 2;
  return (
    <div className="gift" aria-live="polite">
      <div className="gift-head">
        <div>
          <p className="gift-who">Grace&apos;s gift to Maya</p>
          <p className="gift-amt num">$100.00</p>
        </div>
        <span className={`gift-state s${i}`}>{STEPS[i].k}</span>
      </div>
      <div className={`gift-bar ${paid ? "paid" : ""}`} role="img" aria-label={paid ? "$88.27 paid to the hospital, $11.73 never charged" : "$100 held, not charged"}>
        <span className="g-held" /><span className="g-paid" /><span className="g-never" />
      </div>
      <ol className="gift-steps">
        {STEPS.map((s, n) => (
          <li key={s.k} className={n < i ? "done" : n === i ? "now" : ""}>
            <span className="dot" aria-hidden="true" />
            <span>{s.k}</span>
          </li>
        ))}
      </ol>
      <p className="gift-note">{STEPS[i].note}</p>
      <div className="gift-foot">
        <span><b className="num">{paid ? "$88.27" : "$0.00"}</b> to Riverside Children&apos;s</span>
        <span><b className="num">$0.00</b> to the family or Earmark</span>
      </div>
    </div>
  );
}
