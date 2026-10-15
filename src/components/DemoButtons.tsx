"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DemoButton({ scenario, label, className = "btn" }: { scenario: "honest" | "fraud" | "copycat"; label: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <span style={{ display: "inline-grid", gap: 6 }}>
      <button
        className={className}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr("");
          const r = await fetch("/api/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenario }) });
          const j = await r.json();
          if (!r.ok) { setErr(j.error); setBusy(false); return; }
          router.push(`/c/${j.id}?role=donor`);
        }}
      >
        {busy ? "Reading documents…" : label}
      </button>
      {err && <span className="error tiny">{err}</span>}
    </span>
  );
}
