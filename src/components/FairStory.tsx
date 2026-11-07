"use client";
import { useEffect, useRef } from "react";

// "Fair to real families", told as four line drawings that act out each promise as you scroll.
// Desktop: the section pins and the cards travel sideways; each drawing is scrubbed by its own
// card's position. Phones: the cards stack and each drawing plays as it scrolls past.

const CARDS = [
  { k: "review", t: "Rules never reject anyone", d: "A failed check puts the campaign on hold with the evidence. A person decides, and the family can explain." },
  { k: "pharmacy", t: "Medicines are covered too", d: "Up to 10% of the goal for verified pharmacy or supply receipts, paid to the pharmacy." },
  { k: "family", t: "The family never handles money", d: "Payments go to verified providers only, so nobody can question where it went." },
  { k: "urgent", t: "Built for urgent care", d: "PayPal holds pledges for up to 29 days. Longer treatments settle bill by bill." },
];

const Doc = ({ id, x, y }: { id: string; x: number; y: number }) => (
  <g id={id} transform={`translate(${x} ${y})`}>
    <rect width="26" height="34" rx="3" className="fill" />
    <path d="M6 9h14M6 15h14M6 21h9" />
  </g>
);

function Art({ k }: { k: string }) {
  if (k === "review") return (
    <svg viewBox="0 0 320 200" className="fs-art" aria-hidden="true">
      <path d="M10 150H310" className="dash" />
      <line x1="170" y1="150" x2="170" y2="104" />
      <circle cx="170" cy="94" r="10" className="sign fill" />
      <g className="person">
        <circle cx="170" cy="36" r="24" className="halo dash" />
        <circle cx="170" cy="30" r="6" />
        <path d="M159 48c2-7 6-10 11-10s9 3 11 10" />
        <text x="202" y="40" className="note start">a person decides</text>
      </g>
      <Doc id="doc" x={30} y={114} />
      <path d="M262 132l8 8 16-18" className="tick" pathLength={1} />
    </svg>
  );
  if (k === "pharmacy") return (
    <svg viewBox="0 0 320 200" className="fs-art" aria-hidden="true">
      <defs><clipPath id="fs-bar"><rect x="30" y="96" width="260" height="28" rx="14" /></clipPath></defs>
      <g clipPath="url(#fs-bar)">
        <rect className="hosp" x="30" y="96" width="234" height="28" />
        <rect className="pharm" x="264" y="96" width="26" height="28" />
      </g>
      <rect x="30" y="96" width="260" height="28" rx="14" />
      <path d="M264 90v40" className="dash" />
      <text x="30" y="152" className="note start">hospital bill, 90%</text>
      <text x="290" y="152" className="note end pharm-l">pharmacy, 10%</text>
      <g className="pill" transform="translate(277 30)">
        <g className="pill-in">
          <rect x="-7" y="-16" width="14" height="32" rx="7" />
          <path d="M-7 0h14" />
          <rect x="-7" y="0" width="14" height="16" rx="7" className="warm-fill" />
        </g>
      </g>
    </svg>
  );
  if (k === "family") return (
    <svg viewBox="0 0 320 200" className="fs-art" aria-hidden="true">
      <path id="fs-route" d="M48 128C100 10 220 10 272 118" className="dash" />
      <circle cx="40" cy="140" r="13" />
      <text x="40" y="144.5" className="glyph">$</text>
      <g className="house">
        <path d="M140 150v-26l20-16 20 16v26z" />
        <path d="M154 150v-12h12v12" />
        <text x="160" y="176" className="note">family: $0</text>
      </g>
      <g className="hosp-b">
        <rect x="252" y="114" width="40" height="36" rx="3" className="fill" />
        <path d="M272 122v14M265 129h14" className="cross" />
        <text x="272" y="176" className="note pay-l">hospital: <tspan className="paid">$0</tspan></text>
      </g>
      {[0, 1, 2].map((i) => <circle key={i} className="coin" r="7" cx="0" cy="0" />)}
      <path d="M10 150H310" className="dash faint" />
    </svg>
  );
  // urgent
  const C = 364.42;
  return (
    <svg viewBox="0 0 320 200" className="fs-art" aria-hidden="true">
      {Array.from({ length: 29 }, (_, i) => {
        const a = (i / 29) * Math.PI * 2 - Math.PI / 2;
        const r2 = (v: number) => Math.round(v * 100) / 100;
        return <line key={i} className="tickm" x1={r2(160 + Math.cos(a) * 66)} y1={r2(98 + Math.sin(a) * 66)} x2={r2(160 + Math.cos(a) * 72)} y2={r2(98 + Math.sin(a) * 72)} />;
      })}
      <circle cx="160" cy="98" r="58" className="faint" />
      <circle cx="160" cy="98" r="58" className="arc" strokeDasharray={C} strokeDashoffset={C} transform="rotate(-90 160 98)" />
      <text x="160" y="96" className="day">Day 1</text>
      <text x="160" y="116" className="note">of a 29-day hold</text>
      {[0, 1, 2].map((i) => (
        <g key={i} className="bill" transform={`translate(${256} ${44 + i * 44})`}>
          <rect width="22" height="28" rx="3" className="fill" />
          <path d="M5 8h12M5 13h12" />
          <path d="M4 20l4 4 9-10" className="ok" pathLength={1} />
        </g>
      ))}
    </svg>
  );
}

export default function FairStory() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current!;
    let revert = () => {};
    let alive = true;
    (async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      const { MotionPathPlugin } = await import("gsap/MotionPathPlugin");
      if (!alive) return;
      gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const wide = window.matchMedia("(min-width: 901px)").matches;
      const ctx = gsap.context(() => {
        const q = (s: string) => el.querySelector(s)!;
        const card = (k: string) => q(`.fs-card[data-k="${k}"]`);
        const tl: Record<string, gsap.core.Timeline> = {};
        const make = (k: string) => (tl[k] = gsap.timeline({ paused: true, defaults: { ease: "power2.inOut" } }));

        { const c = card("review"), t = make("review");
          t.to(c.querySelector("#doc"), { x: 140, duration: 0.3 })
           .to(c.querySelector(".sign"), { fill: "#ff6b5a", stroke: "#ff6b5a", duration: 0.06 })
           .to(c.querySelector("#doc"), { x: 157, y: 30, duration: 0.2 })
           .fromTo(c.querySelector(".person"), { opacity: 0.25 }, { opacity: 1, duration: 0.1 }, "<")
           .fromTo(c.querySelector(".halo"), { scale: 0.6, transformOrigin: "170px 36px" }, { scale: 1, duration: 0.12 }, "<")
           .to(c.querySelector(".sign"), { fill: "#3fd1b0", stroke: "#3fd1b0", duration: 0.06 })
           .to(c.querySelector("#doc"), { x: 157, y: 114, duration: 0.14 })
           .to(c.querySelector("#doc"), { x: 222, duration: 0.18 })
           .fromTo(c.querySelector(".tick"), { strokeDashoffset: 1, strokeDasharray: 1 }, { strokeDashoffset: 0, duration: 0.08 }); }

        { const c = card("pharmacy"), t = make("pharmacy");
          t.fromTo(c.querySelector(".hosp"), { attr: { width: 0 } }, { attr: { width: 234 }, duration: 0.5, ease: "power1.inOut" })
           .fromTo(c.querySelector(".pill"), { y: 0, opacity: 0 }, { y: 80, opacity: 1, duration: 0.22, ease: "power2.in" }, 0.42)
           .fromTo(c.querySelector(".pill-in"), { rotate: -50 }, { rotate: 90, duration: 0.22, transformOrigin: "0px 0px" }, 0.42)
           .to(c.querySelector(".pill"), { opacity: 0, scale: 0.4, duration: 0.06 })
           .fromTo(c.querySelector(".pharm"), { attr: { width: 0 } }, { attr: { width: 26 }, duration: 0.14 }, "<")
           .fromTo(c.querySelector(".pharm-l"), { opacity: 0 }, { opacity: 1, duration: 0.1 }); }

        { const c = card("family"), t = make("family");
          const paid = c.querySelector(".paid")!;
          c.querySelectorAll(".coin").forEach((coin, i) => {
            t.fromTo(coin, { opacity: 0 }, { opacity: 1, duration: 0.04 }, i * 0.22)
             .to(coin, { motionPath: { path: c.querySelector("#fs-route") as SVGPathElement, align: c.querySelector("#fs-route") as SVGPathElement, alignOrigin: [0.5, 0.5] }, duration: 0.42, ease: "power1.inOut" }, i * 0.22)
             .to(coin, { opacity: 0, duration: 0.04 })
             .fromTo(c.querySelector(".hosp-b .fill"), { fill: "rgba(255,107,90,0)" }, { fill: "rgba(255,107,90,0.55)", duration: 0.05, yoyo: true, repeat: 1, immediateRender: false }, "<");
          });
          t.eventCallback("onUpdate", () => { const n = [0, 1, 2].filter((i) => t.time() >= i * 0.22 + 0.42).length; paid.textContent = `$${n * 40}`; }); }

        { const c = card("urgent"), t = make("urgent");
          const day = c.querySelector(".day")!, C = 2 * Math.PI * 58;
          const o = { p: 0 };
          t.to(o, { p: 1, duration: 1, ease: "none", onUpdate: () => {
            (c.querySelector(".arc") as SVGCircleElement).style.strokeDashoffset = String(C * (1 - o.p));
            day.textContent = `Day ${Math.max(1, Math.round(o.p * 29))}`;
            c.querySelectorAll(".tickm").forEach((m, i) => m.classList.toggle("on", i / 29 < o.p));
          } });
          c.querySelectorAll(".bill").forEach((b, i) => {
            t.fromTo(b.querySelector(".ok"), { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.06 }, (i + 1) * 0.3)
             .fromTo(b, { opacity: 0.35 }, { opacity: 1, duration: 0.05 }, "<");
          }); }

        if (still) { Object.values(tl).forEach((t) => t.progress(1)); return; }

        if (wide) {
          // Pin the inner wrapper, never the <section> itself: GSAP wraps the pinned node in a
          // spacer div, and if that node is React's own child React crashes when it unmounts it
          // on client-side navigation ("removeChild … not a child of this node").
          const track = q(".fs-track") as HTMLElement;
          const dist = () => track.scrollWidth - (q(".fs-viewport") as HTMLElement).clientWidth;
          const move = gsap.to(track, { x: () => -dist(), ease: "none", scrollTrigger: { trigger: q(".fs-inner") as HTMLElement, start: "top top", end: () => `+=${dist() + window.innerHeight * 0.5}`, pin: true, scrub: 0.6, invalidateOnRefresh: true,
            onUpdate: (s) => { const n = Math.min(4, 1 + Math.floor(s.progress * 4)); (q(".fs-count b") as HTMLElement).textContent = `0${n}`; (q(".fs-bar i") as HTMLElement).style.transform = `scaleX(${s.progress})`; } } });
          el.querySelectorAll<HTMLElement>(".fs-card").forEach((c) => {
            const t = tl[c.dataset.k!];
            ScrollTrigger.create({ trigger: c, containerAnimation: move, start: "left 92%", end: "right 62%", scrub: 0.4, onUpdate: (s) => t.progress(s.progress) });
          });
        } else {
          el.querySelectorAll<HTMLElement>(".fs-card").forEach((c) => {
            const t = tl[c.dataset.k!];
            ScrollTrigger.create({ trigger: c, start: "top 85%", end: "bottom 45%", scrub: 0.4, onUpdate: (s) => t.progress(s.progress) });
          });
        }
      }, el);
      revert = () => ctx.revert();
    })();
    return () => { alive = false; revert(); };
  }, []);

  return (
    <section className="fs" ref={root} aria-labelledby="fair">
      <div className="fs-inner">
        <div className="fs-head">
          <h2 id="fair">Fair to real families</h2>
          <p>Stopping fraud must never mean turning away a sick child.</p>
          <div className="fs-count" aria-hidden="true"><b>01</b> / 04<span className="fs-bar"><i /></span></div>
        </div>
        <div className="fs-viewport">
          <div className="fs-track">
            {CARDS.map((c, i) => (
              <article className="fs-card" data-k={c.k} key={c.k}>
                <div className="fs-stage"><Art k={c.k} /></div>
                <svg className="fs-wave" viewBox="0 0 440 16" preserveAspectRatio="none" aria-hidden="true"><path d="M0 8 Q 27.5 0 55 8 T 110 8 T 165 8 T 220 8 T 275 8 T 330 8 T 385 8 T 440 8" /></svg>
                <span className="fs-n">0{i + 1}</span>
                <h3>{c.t}</h3>
                <p>{c.d}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
