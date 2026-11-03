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

// a hospital monitor trace, one beat every 300 units
const ECG = (() => {
  let d = "M0 60";
  for (let x = 0; x < 2400; x += 300) d += ` H${x + 120} l12 -8 l12 8 h14 l8 -46 l12 82 l9 -46 h18 l14 -12 l14 12 H${x + 300}`;
  return d;
})();

type Money = { patient: string; pledged: number; donors: number; paid: number; hospital: string; neverCharged: number };
const EXAMPLE: Money = { patient: "Maya", pledged: 2485, donors: 6, paid: 2295, hospital: "Riverside Children's Hospital", neverCharged: 125.5 };

export default function DocTunnel({ money = EXAMPLE }: { money?: Money }) {
  const section = useRef<HTMLDivElement>(null);
  const canvasBox = useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = useState(0);
  const [typed, setTyped] = useState("");
  const [fallback, setFallback] = useState(false);
  const progress = useRef(0);
  const [count, setCount] = useState(0);

  // the amount in the centre counts up when the holds form and again when the hospital is paid
  useEffect(() => {
    if (chapter < 2) { setCount(0); return; }
    const target = chapter === 3 ? money.paid : money.pledged, from = 0, t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => { const k = Math.min(1, (now - t0) / 1400); setCount(from + (target - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [chapter, money]);

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
          mat.userData.base = mat.map;
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
      // chapter 3: 21 verified pages become PayPal holds, orbiting the hospital in a tilted ring;
      // chapter 4: they spiral into it. The rest of the tunnel dims but stays, so the space never empties.
      const verified = tiles.filter((t) => !t.forged).sort((a, b) => a.seed - b.seed);
      const ring = verified.slice(0, 21);
      // each one turns over into the PayPal hold it becomes (drawn mirrored: we see its back face)
      const WHO = ["Maya R.", "Lucia G.", "Sam O.", "Leila H.", "Aarav S."];
      const AMT = ["$40.00", "$25.00", "$60.00", "$35.00", "$100.00", "$50.00", "$20.00"];
      const holdTex = ring.map((_, i) => {
        const c = document.createElement("canvas"); c.width = 256; c.height = 362;
        const g = c.getContext("2d")!;
        g.translate(256, 0); g.scale(-1, 1);
        g.fillStyle = "#ffffff"; g.fillRect(0, 0, 256, 362);
        g.fillStyle = "#121635"; g.fillRect(0, 0, 256, 74);
        g.fillStyle = "#ffffff"; g.font = "700 22px Manrope, system-ui, sans-serif"; g.fillText("PayPal hold", 22, 46);
        g.strokeStyle = "#ffb08a"; g.lineWidth = 3; g.strokeRect(205, 26, 26, 22); g.beginPath(); g.arc(218, 26, 8, Math.PI, 0); g.stroke();
        g.fillStyle = "#121635"; g.font = "800 46px Manrope, system-ui, sans-serif"; g.fillText(AMT[i % AMT.length], 22, 150);
        g.fillStyle = "#0d9a7a"; g.font = "700 17px Manrope, system-ui, sans-serif"; g.fillText("Authorized, not charged", 22, 186);
        g.fillStyle = "#5a5f85"; g.font = "500 17px Manrope, system-ui, sans-serif"; g.fillText(`for ${WHO[i % WHO.length]}`, 22, 222);
        g.fillStyle = "#e8eaf6"; g.fillRect(22, 262, 212, 1.5);
        g.fillStyle = "#5a5f85"; g.font = "500 14px Manrope, system-ui, sans-serif"; g.fillText("Pays only the verified", 22, 296); g.fillText("hospital bill", 22, 316);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
      });
      const holders = new Set(ring);
      let ringR = 4.9, ringD = 14, hospScale = 1;

      // the hospital: a shader light (no textures, so no banding or fog tint)
      const sunMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uI: { value: 0 }, uWarm: { value: 0 } },
        transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          uniform float uTime, uI, uWarm; varying vec2 vUv;
          float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
          void main(){
            vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
            float core = 0.0;
            float halo = exp(-r * 4.0) * 0.55;
            float rays = 0.0, ring = 0.0;
            float ph = fract(uTime * 0.6);
            float pulse = smoothstep(0.03, 0.0, abs(r - ph * 0.95)) * (1.0 - ph) * 0.5 * uWarm;
            vec3 cool = vec3(0.50, 0.60, 1.0), warm = vec3(1.0, 0.58, 0.42), white = vec3(1.0, 0.96, 0.92);
            vec3 tint = mix(cool, warm, uWarm);
            vec3 col = white * core * 1.6 + tint * (halo + rays + ring + pulse);
            col *= uI * smoothstep(1.0, 0.6, r);
            col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
            gl_FragColor = vec4(max(col, 0.0), 1.0);
          }`,
      });
      const sun = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), sunMat);
      sun.renderOrder = -1;
      scene.add(sun);

      // the hospital the money is for: a building whose windows light up as each hold is paid
      const hc = document.createElement("canvas"); hc.width = 640; hc.height = 560;
      const hg = hc.getContext("2d")!;
      const hTex = new THREE.CanvasTexture(hc); hTex.colorSpace = THREE.SRGBColorSpace;
      const WIN = 15;
      const rr = (x: number, y: number, w: number, h: number, r: number) => { hg.beginPath(); hg.roundRect(x, y, w, h, r); };
      const drawHosp = (lit: number, warm: boolean) => {
        hg.clearRect(0, 0, 640, 560);
        const line = warm ? "rgba(255,196,170,0.95)" : "rgba(170,185,255,0.85)";
        // body
        rr(110, 170, 420, 330, 18); hg.fillStyle = "rgba(14,19,58,0.92)"; hg.fill(); hg.lineWidth = 5; hg.strokeStyle = line; hg.stroke();
        // roof sign with the cross
        rr(270, 60, 100, 100, 24); hg.fillStyle = warm ? "#ff6b5a" : "#3a5bd9"; hg.fill();
        hg.fillStyle = "#fff"; hg.fillRect(308, 80, 24, 60); hg.fillRect(290, 98, 60, 24);
        hg.fillStyle = line; hg.fillRect(316, 160, 8, 12);
        // windows, 3 floors x 5
        for (let i = 0; i < WIN; i++) {
          const col = i % 5, row = Math.floor(i / 5);
          const x = 146 + col * 74, y = 200 + row * 70;
          rr(x, y, 48, 40, 7);
          if (i < lit) { hg.shadowColor = "rgba(255,170,130,0.9)"; hg.shadowBlur = 24; hg.fillStyle = "#ffe1d2"; hg.fill(); hg.shadowBlur = 0; }
          else { hg.fillStyle = "rgba(255,255,255,0.07)"; hg.fill(); hg.lineWidth = 2; hg.strokeStyle = "rgba(255,255,255,0.18)"; hg.stroke(); }
        }
        // door and ground
        rr(286, 418, 68, 82, 8); hg.fillStyle = lit >= WIN ? "#ffe1d2" : "rgba(255,255,255,0.12)"; hg.fill();
        hg.fillStyle = line; hg.fillRect(40, 498, 560, 5);
        hTex.needsUpdate = true;
      };
      drawHosp(0, false);
      let hospState = "";
      const hosp = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 4.2), new THREE.MeshBasicMaterial({ map: hTex, transparent: true, opacity: 0, depthWrite: false, fog: false }));
      scene.add(hosp);

      // a field of light dust through the whole tunnel; it drifts toward you, then flows into the hospital
      const PN = window.innerWidth < 700 ? 320 : 700;
      const pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pSize = new Float32Array(PN), pShape = new Float32Array(PN);
      const palette = [new THREE.Color(0x9fb0ff), new THREE.Color(0xffffff), new THREE.Color(0xffb08a), new THREE.Color(0x6d8bff)];
      for (let i = 0; i < PN; i++) {
        const ang = rnd(i * 3 + 1) * Math.PI * 2, rad = 0.6 + Math.pow(rnd(i * 3 + 2), 0.6) * 4.2;
        pPos.set([Math.cos(ang) * rad * 1.05, Math.sin(ang) * rad * 0.62, 8 - rnd(i * 3 + 3) * 58], i * 3);
        const c = palette[Math.floor(rnd(i + 99) * (rnd(i + 7) < 0.7 ? 2 : 4))];
        pCol.set([c.r, c.g, c.b], i * 3);
        pShape[i] = rnd(i + 23) < 0.55 ? 0 : 1; // 0 = medical cross, 1 = coin
        pSize[i] = 1.2 + Math.pow(rnd(i + 51), 3) * 2.4;
      }
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
      pGeo.setAttribute("aColor", new THREE.BufferAttribute(pCol, 3));
      pGeo.setAttribute("aSize", new THREE.BufferAttribute(pSize, 1));
      pGeo.setAttribute("aShape", new THREE.BufferAttribute(pShape, 1));
      const pMat = new THREE.ShaderMaterial({
        uniforms: { uWarm: { value: 0 }, uTravel: { value: 0 }, uCam: { value: 7 }, uPix: { value: Math.min(2, window.devicePixelRatio) }, uFade: { value: 1 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `
          attribute vec3 aColor; attribute float aSize; attribute float aShape; uniform float uTravel, uCam, uPix, uFade, uWarm; varying vec3 vC; varying float vA; varying float vS;
          void main(){
            vec3 p = position; p.z = mod(p.z + uTravel - uCam + 50.0, 58.0) + uCam - 50.0;
            vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = -mv.z;
            gl_Position = projectionMatrix * mv;
            gl_PointSize = aSize * uPix * 30.0 / max(d, 0.5);
            vA = smoothstep(48.0, 16.0, d) * smoothstep(0.6, 3.0, d) * uFade; vS = aShape; vC = aShape > 0.5 ? mix(vec3(1.0, 0.72, 0.45), vec3(1.0, 0.62, 0.42), uWarm) : mix(vec3(0.62, 0.70, 1.0), vec3(1.0, 0.85, 0.8), uWarm * 0.5);
          }`,
        fragmentShader: `
          varying vec3 vC; varying float vA; varying float vS;
          void main(){
            vec2 q = gl_PointCoord - 0.5; float a;
            if (vS < 0.5) { // a plus sign: the medical cross
              vec2 aq = abs(q); float arm = min(max(aq.x, aq.y), 0.42); float bar = min(aq.x, aq.y);
              a = smoothstep(0.13, 0.08, bar) * smoothstep(0.42, 0.36, max(aq.x, aq.y));
            } else { // a coin: a ring with a bright rim
              float d = length(q); a = smoothstep(0.42, 0.36, d) * (0.45 + 0.55 * smoothstep(0.24, 0.34, d));
            }
            gl_FragColor = vec4(vC * a * vA * 0.55, 1.0);
          }`,
      });
      const dust = new THREE.Points(pGeo, pMat);
      dust.frustumCulled = false;
      scene.add(dust);

      // the scan plane
      const scan = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.4, H + 0.4), new THREE.MeshBasicMaterial({ color: 0x6d8bff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      const scanEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(W, H)), new THREE.LineBasicMaterial({ color: 0x9fb0ff, transparent: true, opacity: 0 }));
      scene.add(scan, scanEdge);

      const resize = () => { const r = box.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.fov = r.width < 700 ? 72 : 58; camera.updateProjectionMatrix(); ringR = camera.aspect < 1 ? 2.6 : 4.9; hospScale = camera.aspect < 1 ? 0.72 : 1; ringD = camera.aspect < 1 ? 15 : 14; };
      resize();
      window.addEventListener("resize", resize);

      const clamp = (v: number) => Math.max(0, Math.min(1, v));
      const ease = (v: number) => v * v * (3 - 2 * v);
      const cBlue = new THREE.Color(0x6d8bff), cTeal = new THREE.Color(0x3fd1b0), cRed = new THREE.Color(0xff5a4a), cIdle = new THREE.Color(0x6d76b8), cWarm = new THREE.Color(0xffb08a);
      const tmp = new THREE.Color(), v = new THREE.Vector3(), v2 = new THREE.Vector3(), q = new THREE.Quaternion(), qy = new THREE.Quaternion(), faceCam = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0);
      let travel = 0, lastHold = "", lastPay = "";
      const el = section.current!;
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
        const dt = Math.min(0.1, (now - last) / 1000);
        smooth += (progress.current - smooth) * (1 - Math.exp(-dt * 7));
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
        const center = v2.set(0, 0, camera.position.z - ringD);
        sun.position.copy(center);
        sun.quaternion.copy(camera.quaternion);
        hosp.position.copy(center); hosp.position.y += 0.15; hosp.quaternion.copy(camera.quaternion);
        (hosp.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity = ease(clamp(c3 * 1.4 - 0.2));
        const lit = Math.round(clamp(c4 * 1.15) * WIN), state = `${lit}${c4 > 0.02}`;
        if (state !== hospState) { drawHosp(lit, c4 > 0.02); hospState = state; }
        hosp.scale.setScalar(hospScale * (1 + (lit > 0 && lit < WIN ? Math.max(0, Math.sin(time * 9)) * 0.012 : 0)));
        sunMat.uniforms.uTime.value = time;
        sunMat.uniforms.uI.value = ease(c3) * 0.35 + ease(c4) * 0.65;
        sunMat.uniforms.uWarm.value = ease(c4);
        // dust drifts toward you, speeds up with scrolling, then reverses and flows into the hospital
        const vel = Math.min(6, Math.abs(progress.current - smooth) * 60);
        travel += dt * ((1.1 + vel) * (1 - ease(c4)) - ease(c4) * 4.5);
        pMat.uniforms.uTravel.value = travel;
        pMat.uniforms.uCam.value = camera.position.z;
        pMat.uniforms.uWarm.value = ease(c4);
        // drive the HTML layer (hospital, windows) from the same clock
        const hv = ease(c3).toFixed(3), pv = c4.toFixed(3);
        if (hv !== lastHold || pv !== lastPay) { el.style.setProperty("--hold", hv); el.style.setProperty("--pay", pv); lastHold = hv; lastPay = pv; }
        for (const t of tiles) {
          const scanned = t.home.z > scanZ || c > 1;
          if (c < 1) tmp.copy(scanned ? cBlue : cIdle);
          else tmp.copy(cIdle).lerp(t.forged ? cRed : cTeal, ease(clamp(c2 * 2)));
          if (c4 > 0 && !t.forged) tmp.lerp(cWarm, c4);
          t.fmat.color.copy(tmp);
          t.fmat.opacity = (scanned ? 0.55 : 0.16) + (t.forged && c2 > 0 && c2 < 1 ? Math.sin(time * 10) * 0.15 : 0);
          t.mesh.scale.setScalar(1);
          if (t.forged) {
            const fall = ease(clamp(c2 * 1.4 - 0.35));
            v.copy(t.home); v.y -= fall * (7 + t.seed * 5); v.x *= 1 + fall * 0.4; v.z += fall * 2;
            t.mesh.position.copy(v);
            t.mesh.quaternion.copy(t.homeQ);
            t.mesh.rotateZ(fall * (t.seed - 0.5) * 3); t.mesh.rotateX(fall * 1.2);
            const o = 1 - clamp(fall * 1.3);
            t.mat.opacity = 0.96 * o; t.fmat.opacity *= o;
            t.mat.color.setRGB(1, 1 - ease(clamp(c2 * 2)) * 0.45, 1 - ease(clamp(c2 * 2)) * 0.5);
          } else if (!holders.has(t)) {
            // the rest of the tunnel recedes into a dim backdrop
            const d = ease(clamp(c3 * 1.8 - t.seed * 0.3));
            t.mesh.position.copy(t.home); t.mesh.quaternion.copy(t.homeQ);
            const o = 1 - d * 0.78 - ease(c4) * 0.12;
            t.mat.opacity = 0.96 * o; t.fmat.opacity *= o;
            t.mat.color.setRGB(1 - d * 0.35, 1 - d * 0.3, 1 - d * 0.15);
          } else {
            const i = ring.indexOf(t);
            const p4 = ease(clamp(c4 * 1.5 - t.seed * 0.45));
            const ang = (i / ring.length) * Math.PI * 2 + time * 0.18 + p4 * 5;
            const r = ringR * (1 - p4);
            v.set(Math.sin(ang) * r, Math.cos(ang) * r * 0.22 + Math.sin(ang * 2 + time) * 0.12 * (1 - p4), Math.cos(ang) * r * 0.9).add(center);
            const g = ease(clamp(c3 * 1.25 - t.seed * 0.25));
            const flip = ease(clamp(g * 1.6 - 0.45));
            q.copy(faceCam); q.multiply(qy.setFromAxisAngle(yAxis, Math.sin(ang) * 0.6 + flip * Math.PI));
            const want = flip > 0.5 ? holdTex[i] : (t.mat.userData.base as typeof holdTex[number]);
            if (t.mat.map !== want) { t.mat.map = want; t.mat.needsUpdate = true; }
            t.mesh.position.copy(t.home).lerp(v, g);
            t.mesh.quaternion.copy(t.homeQ).slerp(q, g);
            t.mesh.scale.setScalar((1 - g * 0.22) * (1 - p4 * 0.92));
            const fadeIn = 1 - clamp(p4 * 1.25 - 0.25);
            t.mat.opacity = 0.96 * fadeIn;
            t.fmat.opacity = Math.max(t.fmat.opacity, 0.7 * g) * fadeIn;
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
      cleanup = () => { io.disconnect(); window.removeEventListener("resize", resize); renderer.dispose(); geo.dispose(); frameGeo.dispose(); pGeo.dispose(); pMat.dispose(); sunMat.dispose(); hTex.dispose(); tex.forEach((x) => x.dispose()); holdTex.forEach((x) => x.dispose()); renderer.domElement.remove(); };
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
        <div className={`dt-paid ${chapter >= 2 ? "on" : ""} ${chapter === 3 ? "warm" : ""}`} aria-hidden="true">
          <b><span className="num">${count.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> {chapter === 3 ? `to ${money.hospital.replace(" Hospital", "")}` : `pledged for ${money.patient}`}</b>
          <span>{chapter === 3 ? `Paid by PayPal Payouts. $${money.neverCharged.toLocaleString("en-US", { minimumFractionDigits: 2 })} was never charged. The family received $0.` : `${money.donors} donors, as PayPal holds: authorized, not charged.`}</span>
        </div>
        <svg className={`dt-ecg c${chapter}`} viewBox="0 0 2400 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path className="base" d={ECG} />
          <path className="beat" d={ECG} pathLength={2400} />
          <path className="beat b2" d={ECG} pathLength={2400} />
        </svg>
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
