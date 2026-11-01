"use client";
import { useEffect, useState } from "react";
import { MARK } from "./Logo";

// Opening sequence, once per visit: the mark is constructed the way it was designed —
// sketch lines on a grid, the outline, the folded corner, the check — then the curtain lifts.
// An inline script in <head> sets <html data-splash="skip"> on repeat visits and for reduced
// motion, so nothing flashes. Click or any key skips it. It is pure CSS, so it also clears itself
// without JavaScript.
const TOTAL_MS = 2350;

export default function Splash() {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.splash !== "on") { setGone(true); return; }
    const end = () => { root.dataset.splash = "done"; setGone(true); };
    const skip = () => { root.dataset.splash = "leaving"; window.setTimeout(end, 380); };
    const t = window.setTimeout(end, TOTAL_MS);
    window.addEventListener("keydown", skip, { once: true });
    return () => { window.clearTimeout(t); window.removeEventListener("keydown", skip); };
  }, []);
  if (gone) return null;
  return (
    <div
      className="splash"
      aria-hidden="true"
      onClick={() => { document.documentElement.dataset.splash = "leaving"; window.setTimeout(() => { document.documentElement.dataset.splash = "done"; setGone(true); }, 380); }}
    >
      <div className="splash-mark">
        <svg viewBox="-4 -4 56 56" width="168" height="168">
          <g className="sp-grid">
            <path d="M-2 4H50M-2 24H50M-2 44H50M6-2V50M24-2V50M42-2V50" />
            <circle cx="24" cy="24" r="20" />
            <path d="M30 -2L50 18M-2 30L18 50" />
          </g>
          <path className="sp-outline" d={MARK.page} pathLength={1} />
          <path className="sp-page" d={MARK.page} />
          <path className="sp-fold" d={MARK.fold} />
          <path className="sp-check" d={MARK.check} pathLength={1} />
        </svg>
        <div className="splash-word"><span>Earmark</span></div>
        <div className="splash-line"><span>Donations that can only pay the hospital.</span></div>
      </div>
    </div>
  );
}
