"use client";
import { useEffect, useState } from "react";
import Receipt from "./Receipt";

// Landing hero: a pledge is held, then the verified bill arrives and the pledge splits.
export default function HeroReceipt() {
  const [phase, setPhase] = useState<0 | 1>(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setPhase(1); return; }
    const t = setInterval(() => setPhase((p) => (p === 0 ? 1 : 0)), 3200);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="hero-slip">
        <Receipt donor="Grace" pledged={100} paid={88.27} hospital="Riverside Children's" patient="Maya R." held={phase === 0} />
        {phase === 1 && <span className="stamp paid land" aria-hidden="true">Bill paid<small>Family received $0</small></span>}
      </div>
      <p className="tiny muted" aria-live="polite">
        {phase === 0 ? "Day 1: Grace pledges $100. PayPal holds it; nothing is charged." : "Day 9: the hospital's bill is verified. Grace pays her fair share; the rest is released."}
      </p>
    </div>
  );
}
