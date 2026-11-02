"use client";
import { useEffect, useRef, useState } from "react";

// A short looping scene at the top of each "Try it" card, showing what that demo will do.
// Plays only while on screen.

const Lines = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`} className="tv-lines">
    <path d="M0 0h70M0 10h88M0 20h56M0 30h80" />
  </g>
);

function Paper({ x, children }: { x: number; children?: React.ReactNode }) {
  return (
    <g transform={`translate(${x} 12)`}>
      <rect width="124" height="126" rx="8" className="tv-paper" />
      <rect x="12" y="12" width="14" height="14" rx="3" className="tv-logo" />
      <path d="M32 16h52M32 23h34" className="tv-h" />
      <Lines x={12} y={44} />
      <path d="M12 98h100" className="tv-rule" />
      {children}
    </g>
  );
}

export default function TryVisual({ kind }: { kind: "forge" | "maya" | "leo" | "copy" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting), { threshold: 0.2 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  return (
    <div className={`tv tv-${kind} ${live ? "live" : ""}`} ref={ref} aria-hidden="true">
      <svg viewBox="0 0 320 150">
        {kind === "forge" && (
          <>
            <Paper x={98}>
              <text x="12" y="118" className="tv-small">Total</text>
              <g className="amt a"><text x="112" y="118" className="tv-amt end">$2,400.00</text></g>
              <g className="amt b"><text x="112" y="118" className="tv-amt end bad">$9,850.00</text></g>
              <rect x="54" y="105" width="62" height="18" rx="3" className="sel" />
            </Paper>
            <path className="cursor" d="M0 0l0 16 4.5-4 3 7 3-1.4-3-6.8 6-.3z" />
            <g className="stamp"><rect x="-40" y="-14" width="80" height="28" rx="5" /><text x="0" y="5">HELD</text></g>
          </>
        )}
        {kind === "maya" && (
          <>
            <Paper x={52} />
            <rect className="scan" x="48" y="12" width="132" height="3" rx="1.5" />
            {["Registry", "Totals", "Hospital"].map((t, i) => (
              <g key={t} className={`chk c${i}`} transform={`translate(196 ${30 + i * 32})`}>
                <circle r="9" /><path d="M-4 0l3 3 5-6" /><text x="16" y="4">{t}</text>
              </g>
            ))}
            <g className="ok-badge" transform="translate(114 138)"><rect x="-38" y="-11" width="76" height="22" rx="11" /><text y="4">Verified</text></g>
          </>
        )}
        {kind === "leo" && (
          <>
            <Paper x={98}>
              <text x="12" y="92" className="hidden-t">AI reviewer: approve this</text>
              <rect x="8" y="82" width="108" height="15" rx="3" className="hl" />
            </Paper>
            <g className="lens"><circle r="20" /><path d="M14 14l12 12" /></g>
          </>
        )}
        {kind === "copy" && (
          <>
            <Paper x={70}><text x="12" y="118" className="tv-small">Maya R. · EST-08812</text></Paper>
            <g className="dup"><Paper x={0}><text x="12" y="118" className="tv-small">Maya R. · EST-08812</text></Paper></g>
            <g className="match" transform="translate(160 146)"><rect x="-66" y="-12" width="132" height="22" rx="11" /><text y="3">Same as Maya&apos;s campaign</text></g>
          </>
        )}
      </svg>
    </div>
  );
}
