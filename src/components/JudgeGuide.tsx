"use client";
import Link from "next/link";
import { useState } from "react";

// A short, optional walkthrough for hackathon judges, with the PayPal SANDBOX test buyer login
// (a fake account with fake money) so a pledge takes a minute, not a sign-up.

type Login = { email: string; password: string } | null;

export default function JudgeGuide({ login }: { login: Login }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState("");
  const copy = async (k: "email" | "password") => {
    if (!login) return;
    try { await navigator.clipboard.writeText(login[k]); setCopied(k); setTimeout(() => setCopied(""), 1500); } catch { /* clipboard blocked */ }
  };
  return (
    <aside className={`jg ${open ? "open" : ""}`} aria-label="Judge walkthrough">
      <div className="wrap jg-bar">
        <span className="jg-dot" aria-hidden="true" />
        <p><b>Judging Earmark?</b> Try the whole thing in about three minutes, with a sandbox PayPal login.</p>
        <button type="button" className="jg-toggle" aria-expanded={open} aria-controls="jg-panel" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide walkthrough" : "Show walkthrough"}
        </button>
      </div>
      <div className="jg-panel" id="jg-panel" hidden={!open}>
        <div className="wrap jg-grid">
          <ol className="jg-steps">
            <li><span className="jg-n">1</span><div><b>Try to forge a bill</b><p>Edit a real hospital estimate and submit it. Watch which checks catch you.</p><Link href="/lab" className="btn soft sm">Open the Forgery Lab</Link></div></li>
            <li><span className="jg-n">2</span><div><b>Give to a verified family</b><p>Pick a family and pledge with the sandbox login. It becomes a PayPal hold; nothing is charged.</p><a href="#families" className="btn soft sm" onClick={() => setOpen(false)}>See the families</a></div></li>
            <li><span className="jg-n">3</span><div><b>Follow the money</b><p>Maya&apos;s campaign ran end to end on the PayPal sandbox: holds, fair-share captures, the rest released, and a Payouts batch to the hospital.</p><Link href="/ledger" className="btn soft sm">Open the ledger</Link></div></li>
            <li><span className="jg-n">4</span><div><b>Let an agent give</b><p>Set two limits and approve once. Ask it for a gift over your limit and watch code refuse it.</p><Link href="/agent" className="btn soft sm">Meet the Giving Agent</Link></div></li>
          </ol>
          <div className="jg-login">
            <b>Sandbox PayPal login</b>
            <p>A PayPal test account with test money. Use it when PayPal asks you to log in.</p>
            {login ? (
              <dl>
                <div><dt>Email</dt><dd><code>{login.email}</code><button type="button" onClick={() => copy("email")}>{copied === "email" ? "Copied" : "Copy"}</button></dd></div>
                <div><dt>Password</dt><dd><code>{login.password}</code><button type="button" onClick={() => copy("password")}>{copied === "password" ? "Copied" : "Copy"}</button></dd></div>
              </dl>
            ) : (
              <p className="muted">Use any PayPal sandbox personal account.</p>
            )}
            <p className="jg-note">Patients, hospitals and documents are fictional, and PayPal runs on its sandbox. In this demo the hospital&apos;s confirmation of the final bill is played by the hospital view; in production it comes from the hospital&apos;s billing office.</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
