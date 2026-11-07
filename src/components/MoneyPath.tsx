"use client";
import { useState } from "react";

// "Where your money goes", in four plain steps a first-time donor can follow. With `share`
// (a real campaign's fair share) it shows exact amounts; without it, the pledge card's
// honest "up to" version. Choosing an amount animates the path again.

const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export default function MoneyPath({ amount: fixed, hospital, share, picker = false, caption }: { amount?: number; hospital: string; share?: number; picker?: boolean; caption?: string }) {
  const [pick, setPick] = useState(50);
  const amount = fixed ?? pick;
  const paid = share ? Math.round(amount * share * 100) / 100 : amount;
  const back = Math.round((amount - paid) * 100) / 100;
  const steps = [
    { k: "reserve", t: `You pledge ${usd(amount)}`, d: "It's reserved on your PayPal. Nothing is charged yet." },
    { k: "check", t: "The hospital confirms the final bill", d: "Earmark checks it against the verified estimate." },
    { k: "pay", t: share ? `${usd(paid)} goes to ${hospital}` : `Up to ${usd(amount)} goes to ${hospital}`, d: "Only your fair share of the real bill, paid by PayPal straight to the hospital." },
    { k: "back", t: share ? `${usd(back)} is released` : "Anything unused is released", d: "Never charged. You don't have to ask for it back." },
  ];
  return (
    <div className="mp" aria-label="Where your money goes">
      {picker && (
        <div className="mp-pick" role="group" aria-label="Try an amount">
          <span>Try an amount:</span>
          {[25, 50, 100, 500].map((a) => (
            <button key={a} type="button" aria-pressed={pick === a} onClick={() => setPick(a)}>{usd(a).replace(".00", "")}</button>
          ))}
        </div>
      )}
      <ol className="mp-steps" key={amount}>
        {steps.map((s, i) => (
          <li key={s.k} className={`mp-${s.k}`} style={{ animationDelay: `${i * 140}ms` }}>
            <span className="mp-dot" aria-hidden="true">{i === 3 ? "↺" : i + 1}</span>
            <b>{s.t}</b>
            <span>{s.d}</span>
          </li>
        ))}
      </ol>
      <p className="mp-foot"><b>The family receives $0 in cash. Earmark keeps $0.</b> {caption}</p>
    </div>
  );
}
