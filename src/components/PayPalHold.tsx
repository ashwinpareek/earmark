"use client";
import { useEffect, useRef, useState } from "react";

type PayPalNS = {
  Buttons: (opts: {
    style?: Record<string, unknown>;
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }, actions: { restart: () => Promise<void> }) => Promise<void>;
    onError?: (err: unknown) => void;
    onCancel?: () => void;
  }) => { render: (el: HTMLElement) => Promise<void>; close?: () => void };
};
declare global { interface Window { paypal?: PayPalNS; } }

function loadSdk(clientId: string, currency: string, paypalOnly = false): Promise<PayPalNS> {
  const src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${currency}&intent=authorize&components=buttons&disable-funding=paylater,venmo${paypalOnly ? ",card" : ""}`;
  const existing = document.querySelector<HTMLScriptElement>("script[data-pp-sdk]");
  if (existing && existing.src === src && window.paypal) return Promise.resolve(window.paypal);
  existing?.remove();
  delete window.paypal;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.dataset.ppSdk = "1";
    s.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error("PayPal SDK did not initialise")));
    s.onerror = () => reject(new Error("Could not load the PayPal SDK"));
    document.head.appendChild(s);
  });
}

export default function PayPalHold(props: {
  mode: "sandbox" | "mock";
  clientId: string | null;
  currency: string;
  amountLabel: string;
  createOrder: () => Promise<string>;
  confirm: (orderId: string) => Promise<void>;
  /** Only the PayPal wallet (e.g. the Giving Agent, which saves the donor's PayPal, not a card). */
  paypalOnly?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const { mode, clientId, currency, paypalOnly = false } = props;
  // Keep the latest callbacks in refs so the PayPal buttons render once, not on every parent render.
  const createRef = useRef(props.createOrder);
  const confirmRef = useRef(props.confirm);
  createRef.current = props.createOrder;
  confirmRef.current = props.confirm;
  const createOrder = () => createRef.current();
  const confirm = (id: string) => confirmRef.current(id);

  useEffect(() => {
    if (mode !== "sandbox" || !clientId || !box.current) return;
    let cancelled = false;
    let instance: { close?: () => void } | undefined;
    loadSdk(clientId, currency, paypalOnly)
      .then((pp) => {
        if (cancelled || !box.current) return;
        box.current.innerHTML = "";
        const b = pp.Buttons({
          style: { layout: "vertical", color: "gold", shape: "rect", label: "donate", height: 44, tagline: false },
          createOrder: () => createRef.current(),
          onApprove: async (data, actions) => {
            setBusy(true);
            setErr("");
            try {
              await confirmRef.current(data.orderID);
            } catch (e) {
              const msg = (e as Error).message;
              // The donor's card or bank was declined: PayPal's guidance is to restart the flow so
              // they can pick another funding source, not to retry the same one.
              if (/INSTRUMENT_DECLINED/.test(msg)) {
                setErr("Your payment method was declined. Choose another one in PayPal.");
                return actions.restart();
              }
              setErr(msg);
            } finally { setBusy(false); }
          },
          onCancel: () => setErr("You closed PayPal. Nothing was held or charged."),
          onError: (e) => setErr(`PayPal error: ${String((e as Error)?.message ?? e)}`),
        });
        instance = b;
        return b.render(box.current);
      })
      .catch((e) => setErr((e as Error).message));
    return () => { cancelled = true; instance?.close?.(); };
  }, [mode, clientId, currency, paypalOnly]);

  if (mode === "mock") {
    return (
      <div className="row">
        <button
          className="btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setErr("");
            try { await confirm(await createOrder()); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
          }}
        >
          {busy ? "Holding…" : `Pledge ${props.amountLabel} with PayPal`}
        </button>
        <span className="muted tiny">Simulated PayPal approval (mock mode)</span>
        {err && <div className="error" role="alert">{err}</div>}
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <JudgeLogin />
      <div ref={box} aria-busy={busy} />
      {busy && <span className="thinking"><span className="spinner" /> Placing the hold on PayPal…</span>}
      {err && <div className="error" role="alert">{err}</div>}
    </div>
  );
}

/** On the sandbox only: the test buyer judges can log in with in PayPal's window. */
function JudgeLogin() {
  const [l, setL] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState("");
  useEffect(() => { fetch("/api/status").then((r) => r.json()).then((s) => setL(s.judgeLogin ?? null)).catch(() => undefined); }, []);
  if (!l) return null;
  const copy = async (k: "email" | "password") => { try { await navigator.clipboard.writeText(l[k]); setCopied(k); setTimeout(() => setCopied(""), 1500); } catch { /* clipboard blocked */ } };
  return (
    <details className="judge-login">
      <summary>Testing? Use the sandbox PayPal login</summary>
      <p>This is PayPal&apos;s <b>sandbox</b>: a test account with test money. Nothing real is charged.</p>
      <dl>
        <div><dt>Email</dt><dd><code>{l.email}</code><button type="button" onClick={() => copy("email")}>{copied === "email" ? "Copied" : "Copy"}</button></dd></div>
        <div><dt>Password</dt><dd><code>{l.password}</code><button type="button" onClick={() => copy("password")}>{copied === "password" ? "Copied" : "Copy"}</button></dd></div>
      </dl>
    </details>
  );
}
