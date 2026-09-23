"use client";

import { useEffect, useRef } from "react";

type Star = {
  x: number; // drifting home position, in CSS px
  y: number;
  z: number; // depth: 0.25 (far) … 1 (near) — near stars are bigger, brighter and move more
  vx: number; // drift velocity, px per second
  vy: number;
  ox: number; // current push away from the cursor
  oy: number;
  r: number; // radius
  a: number; // base opacity
  tw: number; // twinkle speed (0 = steady)
  ph: number; // twinkle phase
  born: number; // when the star starts flying out from the centre (opening burst); 0 once settled
};

type Meteor = { x: number; y: number; vx: number; vy: number; age: number; life: number; len: number };

const DRIFT_MIN = 2; // px/s — stars float slowly
const DRIFT_MAX = 7;
const REPEL_RADIUS = 210; // stars within this distance of the cursor react…
const REPEL_DISTANCE = 64; // …pushed away by up to this many px,
const SWIRL = 0.45; // …swirling around it a little,
const WAKE = 0.09; // …and dragged along behind fast cursor movement
const GLOW = 0.9; // stars near the cursor brighten and grow by up to this much
const EASE = 4; // how quickly stars glide away and back (per second)
const BURST_MS = 1700; // opening burst: how long each star takes to fly out
const SCROLL_PARALLAX = 0.22; // near stars move this fraction of the scroll distance
const MOUSE_PARALLAX = 0.018; // near stars shift this fraction of the cursor's distance from the centre
const METEOR_EVERY = [4000, 9000]; // ms between shooting stars

/**
 * Background star field, as on obclub.co: slow drift with depth, gentle twinkle, scroll and cursor
 * parallax, stars that swirl away from the cursor (brightening as it passes), the occasional shooting
 * star, and an optional opening burst from the centre.
 * Static for visitors who prefer reduced motion. Rendered by <Backdrop>.
 */
export function Starfield({ density = 1, burst }: { density?: number; burst?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let stars: Star[] = [];
    let meteor: Meteor | null = null;
    let nextMeteor = performance.now() + 2500;
    let pointer: { x: number; y: number } | null = null;
    let pvx = 0; // smoothed cursor velocity, px/s
    let pvy = 0;
    let lastMove = 0;
    const burstFrom = burst != null && !reduceMotion ? performance.now() + burst : 0;
    let px = 0; // eased cursor parallax
    let py = 0;
    let raf = 0;
    let last = performance.now();

    const makeStar = (): Star => {
      const z = 0.25 + Math.random() * 0.75;
      const angle = Math.random() * Math.PI * 2;
      const speed = (DRIFT_MIN + Math.random() * (DRIFT_MAX - DRIFT_MIN)) * (0.5 + z * 0.7);
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        z,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ox: 0,
        oy: 0,
        r: (Math.random() < 0.12 ? 1.2 : 0.75) * (0.55 + z * 0.7),
        a: (0.25 + Math.random() * 0.55) * (0.55 + z * 0.45),
        tw: Math.random() < 0.4 ? 0.5 + Math.random() * 1.2 : 0,
        ph: Math.random() * Math.PI * 2,
        born: burstFrom && !stars.length ? burstFrom + Math.random() * 450 : 0,
      };
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const prevW = w;
      const prevH = h;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(260, (w * h) / 8000) * density);
      if (!stars.length) {
        stars = Array.from({ length: count }, makeStar);
      } else {
        for (const s of stars) {
          s.x = (s.x / prevW) * w;
          s.y = (s.y / prevH) * h;
        }
        while (stars.length < count) stars.push(makeStar());
        stars.length = count;
      }
      if (reduceMotion) draw(last);
    };

    const wrap = (v: number, size: number) => ((((v + 20) % (size + 40)) + size + 40) % (size + 40)) - 20;

    const spawnMeteor = () => {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const angle = (18 + Math.random() * 22) * (Math.PI / 180);
      const speed = 650 + Math.random() * 350;
      meteor = {
        x: w * (dir > 0 ? 0.05 + Math.random() * 0.6 : 0.35 + Math.random() * 0.6),
        y: h * Math.random() * 0.4,
        vx: Math.cos(angle) * speed * dir,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: 0.9 + Math.random() * 0.5,
        len: 110 + Math.random() * 90,
      };
    };

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now / 1000;
      const k = 1 - Math.exp(-EASE * dt);
      const scroll = reduceMotion ? 0 : window.scrollY;

      // Ease the cursor parallax toward the cursor's offset from the centre.
      const targetPx = pointer ? -(pointer.x - w / 2) * MOUSE_PARALLAX : 0;
      const targetPy = pointer ? -(pointer.y - h / 2) * MOUSE_PARALLAX : 0;
      px += (targetPx - px) * k;
      py += (targetPy - py) * k;
      const decay = Math.exp(-dt * 5);
      pvx *= decay;
      pvy *= decay;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#fff";

      for (const s of stars) {
        if (!reduceMotion) {
          s.x = wrap(s.x + s.vx * dt, w);
          s.y = wrap(s.y + s.vy * dt, h);
        }
        let hx = wrap(s.x + px * s.z, w);
        let hy = wrap(s.y - scroll * SCROLL_PARALLAX * s.z + py * s.z, h);

        // Opening burst: fly out from the centre of the screen.
        let appear = 1;
        if (s.born) {
          const p = Math.min(Math.max((now - s.born) / BURST_MS, 0), 1);
          if (p >= 1) s.born = 0;
          const e = 1 - (1 - p) ** 4;
          hx = w / 2 + (hx - w / 2) * e;
          hy = h / 2 + (hy - h / 2) * e;
          appear = Math.min(p * 3, 1);
        }

        let near = 0;
        if (!reduceMotion) {
          let tx = 0;
          let ty = 0;
          if (pointer) {
            const dx = hx - pointer.x;
            const dy = hy - pointer.y;
            const dist = Math.hypot(dx, dy);
            if (dist < REPEL_RADIUS) {
              const f = (1 - dist / REPEL_RADIUS) ** 2;
              const push = f * REPEL_DISTANCE * (0.6 + s.z * 0.4);
              const ux = dist > 0.01 ? dx / dist : 1;
              const uy = dist > 0.01 ? dy / dist : 0;
              tx = ux * push - uy * push * SWIRL + Math.max(-60, Math.min(60, pvx * WAKE * f));
              ty = uy * push + ux * push * SWIRL + Math.max(-60, Math.min(60, pvy * WAKE * f));
            }
            const d2 = Math.hypot(hx + s.ox - pointer.x, hy + s.oy - pointer.y);
            near = d2 < REPEL_RADIUS ? 1 - d2 / REPEL_RADIUS : 0;
          }
          s.ox += (tx - s.ox) * k;
          s.oy += (ty - s.oy) * k;
        }

        const base = s.tw && !reduceMotion ? s.a * (0.55 + 0.45 * Math.sin(t * s.tw + s.ph)) : s.a;
        ctx.globalAlpha = Math.min(1, base + (1 - base) * near * GLOW) * appear;
        ctx.beginPath();
        ctx.arc(hx + s.ox, hy + s.oy, s.r * (1 + near * GLOW), 0, Math.PI * 2);
        ctx.fill();
      }

      // Shooting star
      if (!reduceMotion) {
        if (!meteor && now > nextMeteor) spawnMeteor();
        if (meteor) {
          const m: Meteor = meteor;
          m.age += dt;
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          const p = m.age / m.life;
          if (p >= 1) {
            meteor = null;
            nextMeteor = now + METEOR_EVERY[0] + Math.random() * (METEOR_EVERY[1] - METEOR_EVERY[0]);
          } else {
            const fade = Math.sin(Math.PI * p);
            const speed = Math.hypot(m.vx, m.vy);
            const tailX = m.x - (m.vx / speed) * m.len * fade;
            const tailY = m.y - (m.vy / speed) * m.len * fade;
            const g = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
            g.addColorStop(0, "rgba(255,255,255,0)");
            g.addColorStop(1, `rgba(255,255,255,${0.85 * fade})`);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = g;
            ctx.lineWidth = 1.2;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
            ctx.fillStyle = `rgba(255,255,255,${0.9 * fade})`;
            ctx.beginPath();
            ctx.arc(m.x, m.y, 1.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#fff";
          }
        }
      }

      ctx.globalAlpha = 1;
      if (!reduceMotion) raf = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      if (pointer && now > lastMove) {
        const dtm = Math.max((now - lastMove) / 1000, 0.008);
        pvx = pvx * 0.7 + ((e.clientX - pointer.x) / dtm) * 0.3;
        pvy = pvy * 0.7 + ((e.clientY - pointer.y) / dtm) * 0.3;
      }
      lastMove = now;
      pointer = { x: e.clientX, y: e.clientY };
    };
    const onLeave = (e: MouseEvent) => {
      if (!e.relatedTarget) pointer = null;
    };
    const onRelease = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") pointer = null;
    };
    const clearPointer = () => {
      pointer = null;
    };

    resize();
    window.addEventListener("resize", resize);
    if (!reduceMotion) {
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerup", onRelease, { passive: true });
      window.addEventListener("pointercancel", onRelease, { passive: true });
      window.addEventListener("mouseout", onLeave);
      window.addEventListener("blur", clearPointer);
      raf = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onRelease);
      window.removeEventListener("pointercancel", onRelease);
      window.removeEventListener("mouseout", onLeave);
      window.removeEventListener("blur", clearPointer);
    };
  }, [density, burst]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />;
}
