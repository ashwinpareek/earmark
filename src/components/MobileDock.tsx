"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Phones get a floating dock within thumb reach instead of a crowded top bar.
const ALL = [
  { href: "/agent", label: "Giving Agent" },
  { href: "/lab", label: "Forgery Lab" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/radar", label: "Reuse radar" },
  { href: "/hospital", label: "Providers" },
  { href: "/review", label: "Review queue" },
  { href: "/ledger", label: "Public ledger" },
  { href: "/start", label: "Start a campaign" },
];

export default function MobileDock() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  return (
    <>
      {open && <div className="dock-scrim" onClick={() => setOpen(false)} />}
      <nav className={`dock ${open ? "open" : ""}`} aria-label="Menu">
        {open && (
          <ul className="dock-sheet" id="dock-sheet">
            {ALL.map((l) => (
              <li key={l.href}><Link href={l.href} aria-current={path === l.href ? "page" : undefined}>{l.label}</Link></li>
            ))}
          </ul>
        )}
        <div className="dock-bar">
          <button type="button" className="dock-menu" aria-expanded={open} aria-controls="dock-sheet" onClick={() => setOpen((o) => !o)}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d={open ? "M4 4l10 10M14 4L4 14" : "M3 5h12M3 9h12M3 13h12"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            {open ? "Close" : "Menu"}
          </button>
          <Link href="/lab" className="dock-lab">Forge a bill</Link>
        </div>
      </nav>
    </>
  );
}
