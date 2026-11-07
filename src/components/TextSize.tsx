"use client";
import { useEffect, useState } from "react";

// A one-tap "larger text" switch for donors who find the default small. Remembered per browser.
export default function TextSize() {
  const [big, setBig] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem("em-text") === "lg") { setBig(true); document.documentElement.classList.add("text-lg"); } } catch {}
  }, []);
  const toggle = () => {
    const next = !big;
    setBig(next);
    document.documentElement.classList.toggle("text-lg", next);
    try { localStorage.setItem("em-text", next ? "lg" : ""); } catch {}
  };
  return (
    <button type="button" className="text-toggle" aria-pressed={big} onClick={toggle} title={big ? "Use normal text size" : "Use larger text"}>
      <span aria-hidden="true">A<span style={{ fontSize: "1.25em" }}>A</span></span>
      <span className="sr-only">Larger text</span>
    </button>
  );
}
