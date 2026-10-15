"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Prov = { id: string; name: string; city: string; country: string; verifiedSince: string };
type Kind = "estimate" | "identity" | "medical_note";

const SLOTS: { kind: Kind; title: string; hint: string; required: boolean }[] = [
  { kind: "estimate", title: "Hospital cost estimate", hint: "Required. The document showing what the family owes.", required: true },
  { kind: "identity", title: "Patient registration card", hint: "Lets Earmark confirm it's the same patient everywhere.", required: false },
  { kind: "medical_note", title: "Doctor's note or discharge summary", hint: "Shows the treatment is real and needed.", required: false },
];

const STEPS = ["Reading the documents", "Checking the hospital against the registry", "Adding up every line", "Cross-checking the patient", "Searching other campaigns for reused documents", "Looking for edits and hidden text"];

const SAMPLES: Record<string, { files: Record<Kind, string | null>; form: Partial<Record<string, string>> }> = {
  maya: {
    files: { estimate: "maya-estimate.png", identity: "maya-registration.png", medical_note: "maya-clinical-note.png" },
    form: { organizerName: "Elena Rodriguez", organizerEmail: "elena.rodriguez@example.com", relationship: "Mother", title: "Help Maya recover from emergency surgery", story: "Maya woke up with terrible stomach pain on a Sunday night and needed emergency surgery for appendicitis. Our insurance covers most of it, but our share is more than we can manage right now." },
  },
  leo: {
    files: { estimate: "leo-estimate.png", identity: "leo-registration.png", medical_note: null },
    form: { organizerName: "J. Martin", organizerEmail: "help.leo.fund@example.net", relationship: "Uncle", title: "URGENT: Leo needs spinal surgery NOW", story: "Little Leo needs urgent spinal surgery and every hour counts. Please give whatever you can!" },
  },
};

export default function Start() {
  const router = useRouter();
  const [provs, setProvs] = useState<Prov[]>([]);
  const [f, setF] = useState({ providerId: "", organizerName: "", organizerEmail: "", relationship: "Parent", title: "", story: "" });
  const [files, setFiles] = useState<Partial<Record<Kind, File>>>({});
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");

  useEffect(() => { fetch("/api/providers").then((r) => r.json()).then((p: Prov[]) => { setProvs(p); setF((x) => ({ ...x, providerId: x.providerId || p[0]?.id || "" })); }); }, []);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 1600);
    return () => clearInterval(t);
  }, [busy]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function loadSample(name: "maya" | "leo") {
    const s = SAMPLES[name];
    const next: Partial<Record<Kind, File>> = {};
    for (const [k, file] of Object.entries(s.files) as [Kind, string | null][]) {
      if (!file) continue;
      const b = await (await fetch(`/samples/${file}`)).blob();
      next[k] = new File([b], file, { type: "image/png" });
    }
    setFiles(next);
    setF((x) => ({ ...x, ...s.form, providerId: "prov_riverside" }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.estimate) { setErr("Add the hospital's cost estimate."); return; }
    setErr("");
    setBusy(true);
    setStep(0);
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => fd.append(k, v));
    (Object.entries(files) as [Kind, File][]).forEach(([k, file]) => fd.append(k, file));
    const r = await fetch("/api/campaigns", { method: "POST", body: fd });
    const j = await r.json();
    if (!r.ok) { setErr(j.error ?? "Something went wrong"); setBusy(false); return; }
    router.push(`/c/${j.id}?role=organizer`);
  }

  if (busy) {
    return (
      <div className="wrap" style={{ maxWidth: 640, padding: "60px 24px" }}>
        <h1 style={{ fontSize: 32, letterSpacing: "-0.03em" }}>Checking your documents</h1>
        <p className="muted" style={{ marginTop: 8 }}>This takes a few seconds. Nothing is published until the checks are done.</p>
        <ol className="progress" aria-live="polite">
          {STEPS.map((s, i) => (
            <li key={s} className={i < step ? "done" : i === step ? "now" : ""}>
              {i < step ? <span className="mark pass" aria-hidden="true">✓</span> : i === step ? <span className="spinner" /> : <span style={{ width: 22 }} />}
              {s}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className="wrap start">
      <div>
        <h1>Start a campaign</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Upload the hospital&apos;s documents and Earmark checks them before anyone can donate. Money raised is paid to the hospital, against the final bill.
        </p>
        <div className="row" style={{ marginTop: 14 }}>
          <span className="small muted">Fill with sample documents:</span>
          <button type="button" className="btn ghost sm" onClick={() => loadSample("maya")}>Maya (genuine)</button>
          <button type="button" className="btn ghost sm" onClick={() => loadSample("leo")}>Leo (doctored)</button>
        </div>
        <form className="form" onSubmit={submit}>
          <label className="field">Hospital
            <select value={f.providerId} onChange={set("providerId")} required>
              {provs.map((p) => <option key={p.id} value={p.id}>{p.name}, {p.city}</option>)}
            </select>
            <span className="hint">Only verified hospitals can receive money. Don&apos;t see yours? Ask the hospital&apos;s billing office to join.</span>
          </label>
          <div className="stack">
            {SLOTS.map((s) => (
              <div key={s.kind} className={`drop ${files[s.kind] ? "has" : ""}`}>
                <div>
                  <b>{s.title}{s.required ? "" : " (optional)"}</b>
                  <span>{files[s.kind] ? files[s.kind]!.name : s.hint}</span>
                </div>
                <label className="btn ghost sm" style={{ cursor: "pointer" }}>
                  {files[s.kind] ? "Replace" : "Choose file"}
                  <input className="sr" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => { const file = e.target.files?.[0]; if (file) setFiles({ ...files, [s.kind]: file }); }} />
                </label>
              </div>
            ))}
          </div>
          <div className="two">
            <label className="field">Your name<input required value={f.organizerName} onChange={set("organizerName")} autoComplete="name" /></label>
            <label className="field">Your email<input required type="email" value={f.organizerEmail} onChange={set("organizerEmail")} autoComplete="email" /></label>
          </div>
          <label className="field">Your relationship to the patient
            <select value={f.relationship} onChange={set("relationship")}>
              {["Parent", "Mother", "Father", "Spouse", "Child", "Sibling", "Uncle", "Aunt", "Grandparent", "Friend", "Patient (myself)"].map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <label className="field">Campaign title<input required maxLength={90} value={f.title} onChange={set("title")} placeholder="Help Maya recover from emergency surgery" /></label>
          <label className="field">Your story<textarea rows={5} value={f.story} onChange={set("story")} placeholder="What happened, and what the money is for" />
            <span className="hint">Donors see this as your words. The amount comes from the verified documents, not from here.</span>
          </label>
          {err && <div className="error" role="alert">{err}</div>}
          <div><button className="btn">Check documents and publish</button></div>
        </form>
      </div>
      <aside className="aside">
        <p><strong>You never handle the money.</strong> It goes from donors&apos; PayPal straight to the hospital, so nobody can question where it went.</p>
        <p><strong>The goal is set by the documents.</strong> Earmark uses the hospital&apos;s estimate as the target, so you don&apos;t have to guess.</p>
        <p><strong>Donors are only charged for the real bill.</strong> If treatment costs less, the difference is never taken from them.</p>
        <p><strong>Medical documents stay private.</strong> Donors see what was checked, not the documents themselves.</p>
      </aside>
    </div>
  );
}
