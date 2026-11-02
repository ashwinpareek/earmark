"use client";
import { useEffect, useRef, useState } from "react";

// "Why a scam can't cash out": three layers on a line that draws itself as you scroll. Each layer
// lights up with its own small animation: a page being scanned, the hospital's phone, the lock.

const LAYERS = [
  { key: "scan", title: "The documents are investigated", body: "Gemini transcribes every page. Plain rules check it: the hospital's registry details, arithmetic to the cent, one patient everywhere, every document Earmark has ever seen (even cropped, re-saved copies), and hidden text aimed at the AI." },
  { key: "call", title: "The hospital is asked directly", body: "Earmark calls the billing office through its own registry, never the number printed on the paper: did you issue this, for this patient, for this amount?" },
  { key: "lock", title: "The money only pays the verified hospital", body: "Gifts are PayPal holds. They're collected only for a bill the hospital submits, split fairly across donors, and paid only to the hospital's registry-verified PayPal account. The family receives $0, and so does a forger who got this far." },
];

function Icon({ k }: { k: string }) {
  if (k === "scan") return (
    <svg viewBox="0 0 64 64" className="lp-svg scan"><rect x="14" y="8" width="36" height="48" rx="6" className="pg" /><path d="M22 22h20M22 30h20M22 38h12" className="ln" /><rect x="10" y="8" width="44" height="3" rx="1.5" className="beam" /></svg>
  );
  if (k === "call") return (
    <svg viewBox="0 0 64 64" className="lp-svg call"><path d="M22 14c3 0 5 6 5 9s-4 4-4 6 6 10 9 12 4-4 6-4 9 2 9 5-4 7-8 7C26 49 15 38 15 22c0-4 4-8 7-8z" className="ph" /><path d="M40 16a10 10 0 0 1 8 8M41 9a17 17 0 0 1 14 14" className="wave" /></svg>
  );
  return (
    <svg viewBox="0 0 64 64" className="lp-svg lock"><path d="M22 30v-8a10 10 0 0 1 20 0v8" className="shackle" /><rect x="16" y="30" width="32" height="24" rx="6" className="body" /><circle cx="32" cy="41" r="3.5" className="hole" /></svg>
  );
}

export default function LayerPath() {
  const [lit, setLit] = useState<boolean[]>([false, false, false]);
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        const i = Number((e.target as HTMLElement).dataset.i);
        setLit((l) => l.map((v, n) => v || n === i));
      });
    }, { rootMargin: "0px 0px -35% 0px", threshold: 0.4 });
    refs.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, []);
  const n = lit.filter(Boolean).length;
  return (
    <ol className="lp" style={{ ["--lp" as string]: `${(n / LAYERS.length) * 100}%` }}>
      {LAYERS.map((l, i) => (
        <li key={l.key} data-i={i} ref={(el) => { refs.current[i] = el; }} className={lit[i] ? "in" : ""}>
          <span className="lp-node" aria-hidden="true"><Icon k={l.key} /></span>
          <div className="lp-card">
            <span className="lp-n">Layer {i + 1}</span>
            <strong>{l.title}</strong>
            <p>{l.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
