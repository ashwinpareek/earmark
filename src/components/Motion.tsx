"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Page motion, in one place:
//  - headings rise word by word out of a mask as they scroll in
//  - the big statement fills in word by word, scrubbed by scroll
//  - card groups unfold in sequence
//  - cards catch a soft light under the cursor and tilt slightly toward it
//  - buttons lean toward the cursor (magnetic)
// Only things below the fold on load are hidden, so nothing visible ever flashes. Reduced motion: off.

const CARD_GROUPS = [".checklist", ".tryit", ".duo", ".pt-grid", ".mark-parts dl", ".sec-grid", ".steps"];
const CARDS = ".checklist > div, .tryit > .card, .duo-card, .pt-card, .mark-parts dl > div";

function splitWords(el: HTMLElement) {
  if (el.dataset.split) return null;
  if ([...el.childNodes].some((n) => n.nodeType !== Node.TEXT_NODE)) return null;
  const text = el.textContent ?? "";
  el.dataset.split = "1";
  el.setAttribute("aria-label", text);
  el.textContent = "";
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) { el.append(" "); continue; }
    const outer = document.createElement("span"); outer.className = "mw"; outer.setAttribute("aria-hidden", "true");
    const inner = document.createElement("span"); inner.textContent = part;
    outer.append(inner); el.append(outer);
  }
  return el.querySelectorAll<HTMLElement>(".mw > span");
}

export default function Motion() {
  const path = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let revert = () => {};
    let alive = true;
    (async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      if (!alive) return;
      gsap.registerPlugin(ScrollTrigger);
      const below = (el: Element) => el.getBoundingClientRect().top > window.innerHeight * 0.92;
      const ctx = gsap.context(() => {
        document.querySelectorAll<HTMLElement>("main h2, main .page-title").forEach((h) => {
          if (h.closest(".dt, .hx, .sr") || h.classList.contains("sr") || !below(h)) return;
          const words = splitWords(h);
          if (!words) return;
          gsap.from(words, { yPercent: 118, rotate: 5, duration: 1.15, ease: "expo.out", stagger: 0.05, scrollTrigger: { trigger: h, start: "top 88%" } });
        });

        document.querySelectorAll<HTMLElement>(".statement-big").forEach((el) => {
          const words = splitWords(el);
          if (!words) return;
          gsap.fromTo(words, { opacity: 0.12, filter: "blur(3px)" }, { opacity: 1, filter: "blur(0px)", stagger: 0.1, ease: "none", scrollTrigger: { trigger: el, start: "top 85%", end: "bottom 45%", scrub: true } });
        });

        document.querySelectorAll<HTMLElement>(".band .intro, .statement-sub, .sec-head p, .ab-lede, .ab-mcp").forEach((p) => {
          if (!below(p)) return;
          gsap.from(p, { opacity: 0, y: 24, filter: "blur(6px)", duration: 1, ease: "power3.out", scrollTrigger: { trigger: p, start: "top 90%" } });
        });

        for (const sel of CARD_GROUPS) document.querySelectorAll<HTMLElement>(sel).forEach((g) => {
          if (!below(g) || g.closest(".dt")) return;
          gsap.from(g.children, { opacity: 0, y: 80, rotateX: -14, scale: 0.96, transformOrigin: "50% 0%", transformPerspective: 900, duration: 1.25, ease: "expo.out", stagger: 0.1, clearProps: "transform,opacity", scrollTrigger: { trigger: g, start: "top 85%" } });
        });
      });
      revert = () => ctx.revert();
      ScrollTrigger.refresh();
    })();
    return () => { alive = false; revert(); };
  }, [path]);

  // Cursor light, tilt and magnetic buttons (fine pointers only).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !window.matchMedia("(pointer: fine)").matches) return;
    const tag = () => document.querySelectorAll(CARDS).forEach((c) => c.classList.add("spot"));
    tag();
    const mo = new MutationObserver(tag);
    mo.observe(document.body, { childList: true, subtree: true });
    let lastCard: HTMLElement | null = null, lastBtn: HTMLElement | null = null;
    const move = (e: PointerEvent) => {
      const t = e.target as Element | null;
      const card = t?.closest?.<HTMLElement>(".spot") ?? null;
      if (lastCard && lastCard !== card) { lastCard.style.removeProperty("--rx"); lastCard.style.removeProperty("--ry"); }
      if (card) {
        const r = card.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        card.style.setProperty("--mx", `${x}px`); card.style.setProperty("--my", `${y}px`);
        card.style.setProperty("--rx", `${((y / r.height) - 0.5) * -4}deg`); card.style.setProperty("--ry", `${((x / r.width) - 0.5) * 5}deg`);
      }
      lastCard = card;
      const btn = t?.closest?.<HTMLElement>(".btn") ?? null;
      if (lastBtn && lastBtn !== btn) { lastBtn.style.removeProperty("--tx"); lastBtn.style.removeProperty("--ty"); }
      if (btn) {
        const r = btn.getBoundingClientRect();
        btn.style.setProperty("--tx", `${(e.clientX - r.left - r.width / 2) * 0.22}px`);
        btn.style.setProperty("--ty", `${(e.clientY - r.top - r.height / 2) * 0.3}px`);
      }
      lastBtn = btn;
    };
    document.addEventListener("pointermove", move, { passive: true });
    return () => { document.removeEventListener("pointermove", move); mo.disconnect(); };
  }, []);

  return null;
}
