"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Clears this visitor's private demo space so the demo starts fresh. Real campaigns are untouched.
export default function ResetDemo({ className = "btn ghost sm" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <button
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/demo/reset", { method: "POST" });
        setBusy(false);
        setDone(true);
        router.push("/");
        router.refresh();
        setTimeout(() => setDone(false), 2500);
      }}
    >
      {busy ? "Resetting…" : done ? "Demo reset" : "Reset my demo"}
    </button>
  );
}
