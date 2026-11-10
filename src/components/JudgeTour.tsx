"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// A small floating checklist that follows a judge from page to page: the four things worth
// trying, which ones they've already opened, what to do on the page they're on, and the PayPal
// SANDBOX test login (a fake account with fake money). Progress lives in this browser only.

type Login = { email: string; password: string } | null;
type Step = { key: string; href: string; title: string; match: (p: string) => boolean };

const STEPS: Step[] = [
  { key: "lab", href: "/lab", title: "Try to forge a bill", match: (p) => p.startsWith("/lab") },
  { key: "give", href: "/#families", title: "Pledge to a verified family", match: (p) => p.startsWith("/c/") },
  { key: "money", href: "/ledger", title: "Follow the money", match: (p) => p.startsWith("/ledger") },
  { key: "agent", href: "/agent", title: "Let an agent give", match: (p) => p.startsWith("/agent") },
];

const HINTS: [RegExp, string][] = [
  [/^\/lab/, "Pick a quick forgery or edit any number, then submit it. The case file opens step by step and ends in a stamp."],
  [/^\/c\/[^/]+\/receipt/, "Press “Check with PayPal”. PayPal’s own records are read through its Agent Toolkit and compared line by line."],
  [/^\/c\//, "Pledge with the sandbox login below. It becomes a PayPal hold and nothing is charged. Then switch to the Hospital view and send the sample final bill to see the money settle."],
  [/^\/ledger/, "Every hold, capture, release and payout, with PayPal’s own IDs. Try “Ask the ledger”."],
  [/^\/agent/, "Set a $40 limit per gift, then ask it to give $50. Code blocks the request and the agent proposes $40."],
  [/^\/review/, "Campaigns that failed a check wait here for a person. Open one and press X-ray."],
  [/^\/radar/, "Copies of a real family’s documents are linked here, even cropped and re-saved ones."],
  [/^\/start/, "Press “Maya (genuine)” or “Leo (doctored)” to fill the form with sample hospital documents."],
  [/^\/how-it-works/, "The money maths, the ten checks, and the limits we’re honest about."],
  [/^\/campaigns/, "Open any verified family to see its checks and evidence, then pledge."],
  [/^\/$/, "Start with step 1, or scroll down to the verified families."],
];

const KEY = "em-tour";

export default function JudgeTour({ login }: { login: Login }) {
  const path = usePathname() || "/";
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.webdriver) return; // keep automated recordings clean
    let saved: Record<string, boolean> = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { /* storage blocked */ }
    const hit = STEPS.find((s) => s.match(path));
    if (hit && !saved[hit.key]) {
      saved = { ...saved, [hit.key]: true };
      try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* storage blocked */ }
    }
    setDone(saved);
    setReady(true);
  }, [path]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  if (!ready) return null;
  const count = STEPS.filter((s) => done[s.key]).length;
  const hint = HINTS.find(([re]) => re.test(path))?.[1];
  const copy = async (k: "email" | "password") => {
    if (!login) return;
    try { await navigator.clipboard.writeText(login[k]); setCopied(k); setTimeout(() => setCopied(""), 1500); } catch { /* clipboard blocked */ }
  };

  return (
    <div className={`jt ${open ? "open" : ""}`}>
      {open && (
        <section className="jt-panel" id="jt-panel" aria-label="Judge tour">
          <header>
            <b>Judging Earmark?</b>
            <span>Four things to try, about three minutes.</span>
          </header>
          <ol>
            {STEPS.map((s, i) => (
              <li key={s.key} className={done[s.key] ? "done" : ""}>
                <span className="jt-n" aria-hidden="true">{done[s.key] ? "✓" : i + 1}</span>
                <Link href={s.href} onClick={() => setOpen(false)}>{s.title}</Link>
                {done[s.key] && <span className="jt-seen">opened</span>}
              </li>
            ))}
          </ol>
          {hint && <p className="jt-hint"><b>On this page.</b> {hint}</p>}
          {login && (
            <div className="jt-login">
              <b>Sandbox PayPal login</b> <span>(test account, test money)</span>
              <div><code>{login.email}</code><button type="button" onClick={() => copy("email")}>{copied === "email" ? "Copied" : "Copy"}</button></div>
              <div><code>{login.password}</code><button type="button" onClick={() => copy("password")}>{copied === "password" ? "Copied" : "Copy"}</button></div>
            </div>
          )}
          <p className="jt-note">Every patient, hospital and document here is fictional. PayPal runs on its sandbox.</p>
        </section>
      )}
      <button type="button" className="jt-pill" aria-expanded={open} aria-controls="jt-panel" onClick={() => setOpen((o) => !o)}>
        <span className="jt-dot" aria-hidden="true" />
        {open ? "Close the judge tour" : <>Judge tour <i>{count} of {STEPS.length}</i></>}
      </button>
    </div>
  );
}
