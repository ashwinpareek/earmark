"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const money = (v: number | string) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v));

// Live Forgery Lab counters for the home page.
export default function LabScore() {
  const [s, setS] = useState<{ attempts: number; held: number; requested: string } | null>(null);
  useEffect(() => { fetch("/api/lab", { cache: "no-store" }).then((r) => r.json()).then(setS).catch(() => undefined); }, []);
  if (!s || s.attempts === 0) return null;
  return (
    <Link href="/lab" className="labscore">
      <span><b className="num">{s.attempts}</b> forger{s.attempts === 1 ? "y" : "ies"} tried</span>
      <span><b className="num">{money(s.requested)}</b> asked for</span>
      <span className="z"><b className="num">$0</b> paid to forgers</span>
    </Link>
  );
}
