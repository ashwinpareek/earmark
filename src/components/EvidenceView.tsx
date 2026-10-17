"use client";
import { useMemo, useState } from "react";
import type { CampaignView } from "@/lib/views";
import type { Check, EvidenceField, Role } from "@/lib/types";

// Shows reviewers WHERE on the page each flagged check comes from: a box over the printed
// value the rule disagreed with. Rules decide; this only points the human's eye at the evidence.
// "X-ray" pushes the contrast so near-invisible text (prompt injection) becomes readable.

const FIELDS: Record<string, EvidenceField[]> = {
  arithmetic: ["total"],
  tamper: ["total"],
  growth: ["total"],
  provider_contact: ["providerPhone", "providerRegistrationNo"],
  identity: ["patientAge", "patientDob"],
  bill_patient: ["patientName", "patientDob"],
  duplicate: ["documentNumber"],
  hospital_confirmed: ["documentNumber", "patientName", "total"],
  injection: ["instructionsToReader"],
  dates: ["documentDate"],
};

const KIND: Record<string, string> = { estimate: "Estimate", identity: "Registration card", medical_note: "Clinical note", final_bill: "Final bill", receipt: "Care receipt" };

type Box = { key: string; labels: string[]; status: "fail" | "warn"; box: [number, number, number, number] };

export default function EvidenceView({ c, role }: { c: CampaignView; role: Role }) {
  const [xray, setXray] = useState(false);
  const [dims, setDims] = useState<Record<string, [number, number]>>({});
  const pages = useMemo(() => {
    const checks: Check[] = [...(c.verification?.checks ?? []), ...(c.billReview?.checks ?? [])].filter((k) => k.status !== "pass");
    const out: { docId: string; kind: string; boxes: Box[] }[] = [];
    for (const d of c.docs) {
      const ev: { field: EvidenceField; box: [number, number, number, number] }[] = ("extraction" in d && d.extraction?.evidence) || [];
      const boxes: Box[] = [];
      for (const k of checks) {
        if (!k.docIds.includes(d.id)) continue;
        for (const f of FIELDS[k.id] ?? []) {
          const hit = ev.find((e) => e.field === f);
          if (!hit) continue;
          const key = hit.box.join(",");
          const same = boxes.find((b) => b.key === key);
          if (same) {
            if (!same.labels.includes(k.label)) same.labels.push(k.label);
            if (k.status === "fail") same.status = "fail";
          } else boxes.push({ key, labels: [k.label], status: k.status as "fail" | "warn", box: hit.box });
        }
      }
      boxes.sort((a, b) => a.box[0] - b.box[0] || a.box[1] - b.box[1]);
      if (boxes.length && d.mime.startsWith("image/")) out.push({ docId: d.id, kind: d.kind, boxes });
    }
    return out;
  }, [c]);

  if (role === "donor" || pages.length === 0) return null;
  const hasHidden = pages.some((p) => p.boxes.some((b) => b.labels.includes("No hidden instructions")));

  return (
    <section className="section" aria-labelledby="evid">
      <div className="evidence-head">
        <h2 id="evid">Where the problems are</h2>
        <button type="button" className={`btn sm ${xray ? "" : "ghost"}`} aria-pressed={xray} onClick={() => setXray((v) => !v)}>
          {xray ? "X-ray on" : "X-ray"}
        </button>
      </div>
      <p className="tiny muted" style={{ marginBottom: 10 }}>
        Each box marks the printed value a check disagreed with; the list shows it enlarged. {hasHidden ? "Turn on X-ray to read text printed almost white-on-white. " : ""}Only the family, hospital and reviewers see this.
      </p>
      <div className="evidence">
        {pages.map((p) => {
          const src = `/api/docs/${c.id}/${p.docId}?role=${role}`;
          const [nw, nh] = dims[p.docId] ?? [1240, 1754];
          const ar = nw / nh;
          return (
            <figure key={p.docId} className={`ev-page ${xray ? "xray" : ""}`}>
              <div className="ev-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`${KIND[p.kind] ?? p.kind} with flagged fields marked`} onLoad={(e) => { const i = e.currentTarget; setDims((a) => ({ ...a, [p.docId]: [i.naturalWidth, i.naturalHeight] })); }} />
                {p.boxes.map((b, i) => (
                  <span
                    key={b.key}
                    className={`ev-box ${b.status}`}
                    style={{ top: `${b.box[0] / 10}%`, left: `${b.box[1] / 10}%`, height: `${(b.box[2] - b.box[0]) / 10}%`, width: `${(b.box[3] - b.box[1]) / 10}%`, animationDelay: `${i * 120}ms` }}
                    title={b.labels.join(" · ")}
                  >
                    <i>{i + 1}</i>
                  </span>
                ))}
              </div>
              <figcaption>
                <b>{KIND[p.kind] ?? p.kind}</b>
                <ol>
                  {p.boxes.map((b, i) => {
                    const [y0, x0, y1, x1] = b.box;
                    const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
                    return (
                      <li key={b.key} className={b.status}>
                        <span className={`ev-n ${b.status}`}>{i + 1}</span>
                        <div>
                          <div className="ev-lbl">{b.labels.join(" · ")}</div>
                          <div
                            className="ev-zoom"
                            role="img"
                            aria-label={`Enlarged view of the flagged area for ${b.labels.join(", ")}`}
                            style={{
                              backgroundImage: `url(${src})`,
                              aspectRatio: `${(w * ar) / h}`,
                              // Enlarge up to 3× — more only blurs a tiny field.
                              width: `min(100%, ${Math.round((w / 1000) * nw * 3)}px)`,
                              backgroundSize: `${100000 / w}% auto`,
                              backgroundPosition: `${w < 1000 ? (x0 / (1000 - w)) * 100 : 0}% ${h < 1000 ? (y0 / (1000 - h)) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
