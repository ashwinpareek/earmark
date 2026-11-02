"use client";
import { useEffect } from "react";

// Inertial scrolling (Lenis) driven by GSAP's ticker, so scroll-scrubbed scenes stay frame-locked.
// Off for reduced motion and for touch devices, which already scroll natively and smoothly.
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    let dispose = () => {};
    (async () => {
      const [{ default: Lenis }, { gsap }, { ScrollTrigger }] = await Promise.all([import("lenis"), import("gsap"), import("gsap/ScrollTrigger")]);
      gsap.registerPlugin(ScrollTrigger);
      const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.9, anchors: { offset: -72 } });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (t: number) => lenis.raf(t * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      document.documentElement.classList.add("lenis");
      dispose = () => { gsap.ticker.remove(tick); lenis.destroy(); document.documentElement.classList.remove("lenis"); };
    })();
    return () => dispose();
  }, []);
  return null;
}
