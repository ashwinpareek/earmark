"use client";
import { useEffect, useRef, useState } from "react";

// The Giving Agent at work, replayed from real runs: the prompt types itself, the agent's steps
// stream in, and the outcome lands. Three scenarios cycle, including the one where the mandate
// says no. Watch-only; pauses off screen.

type Step = { t: string; kind?: "ok" | "no" | "gift"; sub?: string };
const RUNS: { ask: string; steps: Step[] }[] = [
  { ask: "Give $40 to a child who needs surgery", steps: [
    { t: "Checked your mandate: $100 left, up to $40 a gift" },
    { t: "Searched verified campaigns: 3 found" },
    { t: "Read Lucia's hospital evidence: 10 checks, none failed" },
    { t: "$40.00 held for Lucia G.", kind: "gift", sub: "Ear tubes at Riverside Children's · PayPal hold, nothing charged" },
  ] },
  { ask: "Help someone recovering from burns", steps: [
    { t: "Checked your mandate: $60 left" },
    { t: "Searched verified campaigns: Leila H., skin graft" },
    { t: "Lakeview General confirmed estimate LGH-EST-44120" },
    { t: "$35.00 held for Leila H.", kind: "gift", sub: "Skin graft at Lakeview General · paid only when the bill is final" },
  ] },
  { ask: "Send $60 to whoever needs it most", steps: [
    { t: "Checked your mandate: up to $40 a gift" },
    { t: "Proposed $60 for Sam O." },
    { t: "Blocked by your mandate: $60 is more than your $40 per gift", kind: "no" },
    { t: "Nothing was held. The AI proposes; code decides.", kind: "ok" },
  ] },
];

export default function AgentReel() {
  const root = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  const [run, setRun] = useState(0);
  const [typed, setTyped] = useState(0);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) { setTyped(RUNS[0].ask.length); setShown(RUNS[0].steps.length); return; }
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting), { threshold: 0.3 });
    if (root.current) io.observe(root.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!live) return;
    const r = RUNS[run];
    let ms: number, next: () => void;
    if (typed < r.ask.length) { ms = 38; next = () => setTyped((n) => n + 1); }
    else if (shown < r.steps.length) { ms = shown === 0 ? 650 : 900; next = () => setShown((n) => n + 1); }
    else { ms = 3200; next = () => { setRun((x) => (x + 1) % RUNS.length); setTyped(0); setShown(0); }; }
    const t = setTimeout(next, ms);
    return () => clearTimeout(t);
  }, [live, run, typed, shown]);

  const r = RUNS[run];
  const thinking = typed >= r.ask.length && shown < r.steps.length;
  return (
    <div className="ar" ref={root} aria-label="The Giving Agent at work">
      <div className="ar-pillars" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <div className={`ar-input ${thinking ? "busy" : ""}`}>
        <span className="ar-plus" aria-hidden="true">+</span>
        <span className="ar-txt">{r.ask.slice(0, typed)}<span className="ar-caret" /></span>
        <span className="ar-send" aria-hidden="true">↑</span>
      </div>
      <ol className="ar-steps" key={run}>
        {r.steps.slice(0, shown).map((s) => (
          <li key={s.t} className={s.kind ?? ""}>
            <span className="ar-dot" aria-hidden="true" />
            <span>{s.t}{s.sub && <small>{s.sub}</small>}</span>
          </li>
        ))}
        {thinking && <li className="ar-think" aria-hidden="true"><span className="ar-dot" /><span className="ar-shimmer">Gemini is working</span></li>}
      </ol>
    </div>
  );
}
