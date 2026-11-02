"use client";
import { useEffect, useRef, useState } from "react";

// "How Earmark works", as a WebGL scene you scroll through. The tunnel is built from the actual
// hospital documents in this demo. Four chapters, scrubbed by scroll:
//   01 Read    a scan plane sweeps the tunnel; every page it passes lights up
//   02 Verify  forged pages turn red and fall away; verified ones glow teal
//   03 Hold    verified pages gather in front of you as PayPal holds
//   04 Pay     they stream into one point, the hospital; the family receives $0
// Watch-only. Falls back to a still layout without WebGL or with reduced motion.

const TILES = ["maya-estimate", "maya-registration", "maya-clinical-note", "maya-final-bill", "maya-pharmacy-receipt", "aarav-estimate", "aarav-registration", "leila-estimate", "leila-registration", "sam-estimate", "sam-registration", "lucia-estimate", "lucia-registration", "leo-estimate", "leo-registration"];

const CHAPTERS = [
  { n: "01", k: "Read", h: "Gemini reads every page.", p: "Phone photos, scans and PDFs. Every amount, name and document number is transcribed, with a pointer to where it's printed.", tags: ["Estimates", "Final bills", "Registration cards", "Doctor's notes", "Pharmacy receipts"], ask: "Read Maya's hospital estimate" },
  { n: "02", k: "Verify", h: "Plain rules decide. Forgeries fall away.", p: "The registry, the arithmetic to the cent, one patient everywhere, every document seen before, hidden notes to the AI, and the hospital itself.", tags: ["Registry", "Arithmetic", "Same patient", "Reuse radar", "Hidden instructions", "Hospital confirms"], ask: "Check this bill against the hospital registry" },
  { n: "03", k: "Hold", h: "Every gift is a PayPal hold.", p: "Orders v2 authorizations. Nothing is charged, nobody can spend it, and the family never touches it. A Giving Agent can place them for you, within your limits.", tags: ["Orders v2", "Authorize", "Vault", "Giving Agent", "MCP"], ask: "Give $40 to a child who needs surgery" },
  { n: "04", k: "Pay", h: "Only the hospital is ever paid.", p: "When the hospital confirms the final bill, PayPal captures each donor's fair share, pays the hospital through Payouts, and releases the rest.", tags: ["Partial capture", "Payouts", "Void the rest", "Agent Toolkit check", "$0 to families"], ask: "Show me where my $40 went" },
];

export default function DocTunnel() {
  const section = useRef<HTMLDivElement>(null);
  const canvasBox = useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = useState(0);
  const [typed, setTyped] = useState("");
  const [fallback, setFallback] = useState(false);
  const progress = useRef(0);

  // Scroll progress through the tall section (0..1), driven by GSAP ScrollTrigger.
  useEffect(() => {
    let kill = () => {};
    (async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);
      const st = ScrollTrigger.create({
        trigger: section.current!,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (s) => {
          progress.current = s.progress;
          setChapter(Math.min(3, Math.floor(s.progress * 4 * 0.999)));
        },
      });
      kill = () => st.kill();
    })();
    return () => kill();
  }, []);

  // The agent input types the chapter's prompt.
  useEffect(() => {
    const target = CHAPTERS[chapter].ask;
    let i = 0;
    setTyped("");
    const t = setInterval(() => { i++; setTyped(target.slice(0, i)); if (i >= target.length) clearInterval(t); }, 32);
    return () => clearInterval(t);
  }, [chapter]);

  // The WebGL scene.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setFallback(true); return; }
    let stop = false;
    let cleanup = () => {};
    (async () => {
      const THREE = await import("three");
      const box = canvasBox.current!;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      } catch { setFallback(true); return; }
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      box.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x0b1030, 10, 46);
      const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 120);

      const loader = new THREE.TextureLoader();
      const tex = TILES.map((t) => { const x = loader.load(`/tiles/${t}.jpg`); x.colorSpace = THREE.SRGBColorSpace; x.anisotropy = 4; return x; });
      const forgedSet = new Set(["leo-estimate", "leo-registration"]);

      const W = 8.4, H = 5.2, TW = 1.25, TH = 1.77;
      const geo = new THREE.PlaneGeometry(TW, TH);
      const frameGeo = new THREE.PlaneGeometry(TW + 0.12, TH + 0.12);
      type Tile = { mesh: InstanceType<typeof THREE.Mesh>; frame: InstanceType<typeof THREE.Mesh>; home: InstanceType<typeof THREE.Vector3>; homeQ: InstanceType<typeof THREE.Quaternion>; forged: boolean; hold: InstanceType<typeof THREE.Vector3>; seed: number; mat: InstanceType<typeof THREE.MeshBasicMaterial>; fmat: InstanceType<typeof THREE.MeshBasicMaterial> };
      const tiles: Tile[] = [];
      const group = new THREE.Group();
      scene.add(group);
      let k = 0;
      const rnd = (n: number) => { const x = Math.sin(n * 9301 + 49297) * 233280; return x - Math.floor(x); };
      const walls: { pos: (a: number, z: number) => [number, number, number]; rot: [number, number, number]; span: number[] }[] = [
        { pos: (a, z) => [-W / 2, a, z], rot: [0, Math.PI / 2, 0], span: [-1.1, 1.1] },
        { pos: (a, z) => [W / 2, a, z], rot: [0, -Math.PI / 2, 0], span: [-1.1, 1.1] },
        { pos: (a, z) => [a, -H / 2, z], rot: [-Math.PI / 2, 0, 0], span: [-2.9, -1, 1, 2.9] },
        { pos: (a, z) => [a, H / 2, z], rot: [Math.PI / 2, 0, 0], span: [-2.9, -1, 1, 2.9] },
      ];
      for (let zi = 0; zi < 16; zi++) {
        const z = 2 - zi * 2.35;
        for (const w of walls) for (const a of w.span) {
          k++;
          if (rnd(k) < 0.28) continue;
          const name = TILES[k % TILES.length];
          const mat = new THREE.MeshBasicMaterial({ map: tex[k % TILES.length], transparent: true, opacity: 0.96, side: THREE.DoubleSide, fog: true });
          const fmat = new THREE.MeshBasicMaterial({ color: 0x6d76b8, transparent: true, opacity: 0.18, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
          const mesh = new THREE.Mesh(geo, mat);
          const frame = new THREE.Mesh(frameGeo, fmat);
          const [x, y, zz] = w.pos(a, z + (rnd(k + 7) - 0.5) * 0.6);
          mesh.position.set(x, y, zz);
          mesh.rotation.set(...w.rot);
          frame.position.copy(mesh.position);
          frame.rotation.copy(mesh.rotation);
          frame.translateZ(-0.01);
          group.add(frame, mesh);
          tiles.push({ mesh, frame, home: mesh.position.clone(), homeQ: mesh.quaternion.clone(), forged: forgedSet.has(name) || rnd(k + 3) < 0.12, hold: new THREE.Vector3(), seed: rnd(k + 11), mat, fmat });
        }
      }
      // where verified pages gather in chapter 3: a gentle arc of cards in front of the camera
      // only 21 of them form the arc (7 x 3); the rest dissolve so the arc reads as a clean shape
      const verified = tiles.filter((t) => !t.forged).sort((a, b) => a.seed - b.seed);
      const holders = new Set(verified.slice(0, 21));
      const placeHolds = (dist: number) => verified.slice(0, 21).forEach((t, i) => {
        const cols = 7, row = Math.floor(i / cols), col = i % cols;
        const ang = (col - (cols - 1) / 2) * 0.13;
        t.hold.set(Math.sin(ang) * dist, (1 - row) * 2.0, -Math.cos(ang) * dist);
      });
      // the hospital: a warm light at the end of the tunnel
      const glowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!; const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, "rgba(255,240,230,1)"); r.addColorStop(0.25, "rgba(255,154,107,.85)"); r.addColorStop(1, "rgba(255,107,90,0)"); g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t; })();
      const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      sun.scale.set(11, 11, 1);
      const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, color: 0xfff1e6 }));
      core.scale.set(3.2, 3.2, 1);
      scene.add(sun, core);
      // the scan plane
      const scan = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.4, H + 0.4), new THREE.MeshBasicMaterial({ color: 0x6d8bff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      const scanEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(W, H)), new THREE.LineBasicMaterial({ color: 0x9fb0ff, transparent: true, opacity: 0 }));
      scene.add(scan, scanEdge);

      const resize = () => { const r = box.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.fov = r.width < 700 ? 72 : 58; camera.updateProjectionMatrix(); placeHolds(camera.aspect < 1 ? 19 : 15.5); };
      resize();
      window.addEventListener("resize", resize);

      const clamp = (v: number) => Math.max(0, Math.min(1, v));
      const ease = (v: number) => v * v * (3 - 2 * v);
      const cBlue = new THREE.Color(0x6d8bff), cTeal = new THREE.Color(0x3fd1b0), cRed = new THREE.Color(0xff5a4a), cIdle = new THREE.Color(0x6d76b8), cWarm = new THREE.Color(0xffb08a);
      const tmp = new THREE.Color(), v = new THREE.Vector3(), q = new THREE.Quaternion(), faceCam = new THREE.Quaternion();
      let smooth = 0, visible = true, last = performance.now();
      const t0 = last;
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: "200px" });
      io.observe(box);

      const frame = () => {
        if (stop) return;
        requestAnimationFrame(frame);
        if (!visible) return;
        const now = performance.now();
        const time = (now - t0) / 1000;
        // frame-rate independent easing toward the scroll position
        smooth += (progress.current - smooth) * (1 - Math.exp(-Math.min(0.1, (now - last) / 1000) * 7));
        last = now;
        const c = smooth * 4;
        const c1 = clamp(c), c2 = clamp(c - 1), c3 = clamp(c - 2), c4 = clamp(c - 3);
        camera.position.set(Math.sin(time * 0.3) * 0.15, Math.cos(time * 0.25) * 0.1, 7 - ease(clamp(c / 2)) * 9);
        camera.lookAt(0, 0, camera.position.z - 10);
        faceCam.copy(camera.quaternion);
        const scanZ = 6 - c1 * 42;
        scan.position.z = scanEdge.position.z = scanZ;
        (scan.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity = c1 > 0 && c1 < 1 ? 0.07 : 0;
        (scanEdge.material as InstanceType<typeof THREE.LineBasicMaterial>).opacity = c1 > 0 && c1 < 1 ? 0.9 : 0;
        sun.position.set(0, 0, camera.position.z - 26);
        core.position.copy(sun.position);
        (core.material as InstanceType<typeof THREE.SpriteMaterial>).opacity = ease(c4) * (0.85 + Math.sin(time * 2) * 0.1);
        (sun.material as InstanceType<typeof THREE.SpriteMaterial>).opacity = Math.min(1, ease(c4) * 0.9 + ease(c3) * 0.35);
        for (const t of tiles) {
          const scanned = t.home.z > scanZ || c > 1;
          // colour of the glowing frame
          if (c < 1) tmp.copy(scanned ? cBlue : cIdle);
          else tmp.copy(cIdle).lerp(t.forged ? cRed : cTeal, ease(clamp(c2 * 2)));
          if (c4 > 0 && !t.forged) tmp.lerp(cWarm, c4);
          t.fmat.color.copy(tmp);
          t.fmat.opacity = (scanned ? 0.55 : 0.16) + (t.forged && c2 > 0 && c2 < 1 ? Math.sin(time * 10) * 0.15 : 0);
          if (t.forged) {
            // turn red, then fall away
            const fall = ease(clamp(c2 * 1.4 - 0.35));
            v.copy(t.home); v.y -= fall * (7 + t.seed * 5); v.x *= 1 + fall * 0.4; v.z += fall * 2;
            t.mesh.position.copy(v);
            t.mesh.quaternion.copy(t.homeQ);
            t.mesh.rotateZ(fall * (t.seed - 0.5) * 3); t.mesh.rotateX(fall * 1.2);
            const o = 1 - clamp(fall * 1.3);
            t.mat.opacity = 0.96 * o; t.fmat.opacity *= o;
            t.mat.color.setRGB(1, 1 - ease(clamp(c2 * 2)) * 0.45, 1 - ease(clamp(c2 * 2)) * 0.5);
          } else if (!holders.has(t)) {
            // not part of the arc: dissolve as the others gather
            const d = ease(clamp(c3 * 2.4 - t.seed * 0.4));
            v.copy(t.home); v.z -= d * 6;
            t.mesh.position.copy(v); t.mesh.quaternion.copy(t.homeQ); t.mesh.scale.setScalar(1);
            t.mat.opacity = 0.96 * (1 - d); t.fmat.opacity *= 1 - d;
            t.mat.color.setRGB(1, 1, 1);
          } else {
            // gather into holds, then stream into the hospital
            const g = ease(clamp(c3 * 1.15 - t.seed * 0.15));
            v.copy(t.home).lerp(new THREE.Vector3(t.hold.x, t.hold.y, camera.position.z + t.hold.z), g);
            q.copy(t.homeQ).slerp(faceCam, g);
            const p4 = ease(clamp(c4 * 1.3 - t.seed * 0.3));
            v.lerp(sun.position, p4);
            t.mesh.position.copy(v);
            t.mesh.quaternion.copy(q);
            t.mesh.scale.setScalar(1 - p4 * 0.85);
            t.mat.opacity = 0.96 * (1 - clamp(p4 * 1.2 - 0.2)); t.fmat.opacity = Math.max(t.fmat.opacity, 0.55 * g) * (1 - clamp(p4 * 1.2 - 0.2));
            t.mat.color.setRGB(1, 1, 1);
          }
          t.frame.position.copy(t.mesh.position);
          t.frame.quaternion.copy(t.mesh.quaternion);
          t.frame.scale.copy(t.mesh.scale);
          t.frame.translateZ(-0.012);
        }
        renderer.render(scene, camera);
      };
      frame();
      cleanup = () => { io.disconnect(); window.removeEventListener("resize", resize); renderer.dispose(); geo.dispose(); frameGeo.dispose(); tex.forEach((x) => x.dispose()); renderer.domElement.remove(); };
    })();
    return () => { stop = true; cleanup(); };
  }, []);

  const ch = CHAPTERS[chapter];
  return (
    <section className="dt" ref={section} aria-labelledby="dt-h">
      <div className="dt-sticky">
        <div className="dt-canvas" ref={canvasBox} aria-hidden="true">
          {fallback && <div className="dt-still">{TILES.slice(0, 8).map((t) => <img key={t} src={`/tiles/${t}.jpg`} alt="" />)}</div>}
        </div>
        <div className={`dt-paid ${chapter === 3 ? "on" : ""}`} aria-hidden="true"><b>$2,295.00 to Lakeview General</b><span>Paid by PayPal Payouts. The family received $0, and so would a forger.</span></div>
        <div className="dt-grid" aria-hidden="true"><i /><i /></div>
        <div className="dt-ui">
          <div className="dt-left">
            <span className="dt-chip">{ch.n} · {ch.k}</span>
            <h2 id="dt-h" key={ch.n}>{ch.h}</h2>
          </div>
          <div className="dt-right" key={`r${ch.n}`}>
            <p>{ch.p}</p>
            <div className="dt-tags">{ch.tags.map((t) => <span key={t}>{t}</span>)}</div>
          </div>
          <div className="dt-progress" aria-hidden="true">{CHAPTERS.map((c, i) => <i key={c.n} className={i <= chapter ? "on" : ""} />)}</div>
          <div className="dt-ask" aria-hidden="true"><span className="plus">+</span><span className="txt">{typed}<span className="caret" /></span><span className="send">↑</span></div>
        </div>
        <ol className="sr">{CHAPTERS.map((c) => <li key={c.n}>{c.n} {c.k}: {c.h} {c.p}</li>)}</ol>
      </div>
    </section>
  );
}
