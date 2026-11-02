import Logo from "./Logo";

// The hero's one idea, shown instead of told: messy uploads stream into Earmark from the left and
// leave on the right as verified, PayPal-held gifts (or, for a forgery, held for review).
// Each row is drawn twice in lockstep, a raw layer clipped to the left of the beam and a verified
// layer clipped to the right, so a card transforms exactly as it crosses the light.
// Pure CSS animation: no JavaScript, no layout work per frame.

type Raw = { file: string; lines: number; img?: boolean };
type Done =
  | { k: "verified"; who: string; what: string; where: string; amt: string }
  | { k: "hold"; who: string; amt: string; id: string }
  | { k: "paid"; where: string; amt: string }
  | { k: "held"; why: string; amt: string };

type Card = { raw: Raw; done: Done };

const ROWS: Card[][] = [
  [
    { raw: { file: "IMG_2041.jpg", lines: 4, img: true }, done: { k: "verified", who: "Lucia G., 4", what: "Ear tubes", where: "Riverside Children's", amt: "$990" } },
    { raw: { file: "estimate_scan.pdf", lines: 5 }, done: { k: "hold", who: "for Sam O.", amt: "$40.00", id: "4C20…484U" } },
    { raw: { file: "bill_final(2).png", lines: 3 }, done: { k: "held", why: "Edited total · 6 checks failed", amt: "$9,850" } },
    { raw: { file: "WhatsApp Image.jpeg", lines: 4, img: true }, done: { k: "paid", where: "Lakeview General", amt: "$2,295.00" } },
    { raw: { file: "discharge-note.pdf", lines: 5 }, done: { k: "verified", who: "Leila H., 7", what: "Skin graft", where: "Lakeview General", amt: "$3,200" } },
    { raw: { file: "scan0007.tiff", lines: 4 }, done: { k: "hold", who: "for Lucia G.", amt: "$25.00", id: "9FY2…143T" } },
  ],
  [
    { raw: { file: "hospital estimate.png", lines: 5 }, done: { k: "paid", where: "Riverside Children's", amt: "$88.27" } },
    { raw: { file: "photo 3.heic", lines: 3, img: true }, done: { k: "verified", who: "Sam O., 12", what: "Femur surgery", where: "Lakeview General", amt: "$2,850" } },
    { raw: { file: "invoice_copy.pdf", lines: 4 }, done: { k: "held", why: "Reused estimate number", amt: "$2,400" } },
    { raw: { file: "reg_card.jpg", lines: 4, img: true }, done: { k: "hold", who: "for Leila H.", amt: "$35.00", id: "5JL9…331G" } },
    { raw: { file: "estimate (1).pdf", lines: 5 }, done: { k: "verified", who: "Maya R., 9", what: "Appendectomy", where: "Riverside Children's", amt: "$2,400" } },
    { raw: { file: "Scan_Oct12.png", lines: 3 }, done: { k: "paid", where: "Riverside Children's", amt: "$2,295.00" } },
  ],
  [
    { raw: { file: "bill.jpeg", lines: 4, img: true }, done: { k: "hold", who: "for Maya R.", amt: "$500.00", id: "2096…645D" } },
    { raw: { file: "note_to_reviewer.png", lines: 3 }, done: { k: "held", why: "Hidden note to the AI", amt: "$4,000" } },
    { raw: { file: "estimate_v2.pdf", lines: 5 }, done: { k: "verified", who: "Aarav S., 6", what: "Tonsillectomy", where: "Riverside Children's", amt: "$1,800" } },
    { raw: { file: "IMG_2077.jpg", lines: 4, img: true }, done: { k: "paid", where: "Lakeview General", amt: "$40.00" } },
    { raw: { file: "receipt-pharmacy.png", lines: 4 }, done: { k: "hold", who: "for Aarav S.", amt: "$60.00", id: "8WG7…1715" } },
    { raw: { file: "page_2.pdf", lines: 5 }, done: { k: "verified", who: "Lucia G., 4", what: "Hearing test", where: "Riverside Children's", amt: "$990" } },
  ],
];

function RawCard({ r }: { r: Raw }) {
  return (
    <div className="hb-card raw">
      <div className="hb-raw-top">{r.img ? <span className="hb-thumb" /> : <span className="hb-pdf">PDF</span>}<span className="hb-file">{r.file}</span></div>
      {Array.from({ length: r.lines }, (_, i) => <span key={i} className="hb-skel" style={{ width: `${92 - ((i * 23) % 40)}%` }} />)}
    </div>
  );
}

function DoneCard({ d }: { d: Done }) {
  if (d.k === "verified") return (
    <div className="hb-card ok">
      <div className="hb-row"><span className="hb-badge v">✓ Verified</span><b className="hb-amt">{d.amt}</b></div>
      <b className="hb-who">{d.who}</b>
      <span className="hb-sub">{d.what} · {d.where}</span>
    </div>
  );
  if (d.k === "hold") return (
    <div className="hb-card ok">
      <div className="hb-row"><span className="hb-badge h"><i className="pp">P</i>PayPal hold</span><b className="hb-amt">{d.amt}</b></div>
      <b className="hb-who">Held, not charged</b>
      <span className="hb-sub">{d.who} · {d.id}</span>
    </div>
  );
  if (d.k === "paid") return (
    <div className="hb-card ok">
      <div className="hb-row"><span className="hb-badge p">Paid to hospital</span><b className="hb-amt">{d.amt}</b></div>
      <b className="hb-who">{d.where}</b>
      <span className="hb-sub">Family received $0 · Earmark kept $0</span>
    </div>
  );
  return (
    <div className="hb-card ok bad">
      <div className="hb-row"><span className="hb-badge x">Held for review</span><b className="hb-amt">{d.amt}</b></div>
      <b className="hb-who">Forgery caught</b>
      <span className="hb-sub">{d.why}</span>
    </div>
  );
}

export default function HeroBeam() {
  return (
    <div className="hb" aria-hidden="true">
      <div className="hb-rows">
        {ROWS.map((row, ri) => (
          <div key={ri} className={`hb-lane l${ri}`}>
            <div className="hb-layer raw-layer"><div className="hb-track">{[...row, ...row].map((c, i) => <RawCard key={i} r={c.raw} />)}</div></div>
            <div className="hb-layer ok-layer"><div className="hb-track">{[...row, ...row].map((c, i) => <DoneCard key={i} d={c.done} />)}</div></div>
          </div>
        ))}
      </div>
      <div className="hb-beam"><span className="hb-beam-core" /><span className="hb-beam-glow" /></div>
      <div className="hb-mark"><span className="hb-ring" /><span className="hb-ring r2" /><Logo size={46} /></div>
      <div className="hb-labels"><span>Uploads, as families send them</span><span>Verified gifts, held by PayPal</span></div>
    </div>
  );
}
