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
};

type Meteor = { x: number; y: number; vx: number; vy: number; age: number; life: number; len: number };

const DRIFT_MIN = 2; // px/s — stars float slowly
const DRIFT_MAX = 7;
const REPEL_RADIUS = 150; // stars within this distance of the cursor move away…
const REPEL_DISTANCE = 26; // …by at most this many px
const EASE = 3; // how quickly stars glide away and back (per second)
const SCROLL_PARALLAX = 0.22; // near stars move this fraction of the scroll distance
const MOUSE_PARALLAX = 0.018; // near stars shift this fraction of the cursor's distance from the centre
const METEOR_EVERY = [4000, 9000]; // ms between shooting stars

/**
 * Background star field, as on obclub.co: slow drift with depth, gentle twinkle, scroll and cursor
 * parallax, stars that ease away from the cursor, and the occasional shooting star.
 * Static for visitors who prefer reduced motion. Rendered by <Backdrop>.
 */
export function Starfield({ density = 1 }: { density?: number }) {
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

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#fff";

      for (const s of stars) {
        if (!reduceMotion) {
          s.x = wrap(s.x + s.vx * dt, w);
          s.y = wrap(s.y + s.vy * dt, h);
        }
        const hx = wrap(s.x + px * s.z, w);
        const hy = wrap(s.y - scroll * SCROLL_PARALLAX * s.z + py * s.z, h);

        if (!reduceMotion) {
          let tx = 0;
          let ty = 0;
          if (pointer) {
            const dx = hx - pointer.x;
            const dy = hy - pointer.y;
            const dist = Math.hypot(dx, dy);
            if (dist < REPEL_RADIUS) {
              const push = (1 - dist / REPEL_RADIUS) ** 2 * REPEL_DISTANCE * (0.6 + s.z * 0.4);
              tx = dist > 0.01 ? (dx / dist) * push : push;
              ty = dist > 0.01 ? (dy / dist) * push : 0;
            }
          }
          s.ox += (tx - s.ox) * k;
          s.oy += (ty - s.oy) * k;
        }

        ctx.globalAlpha = s.tw && !reduceMotion ? s.a * (0.55 + 0.45 * Math.sin(t * s.tw + s.ph)) : s.a;
        ctx.beginPath();
        ctx.arc(hx + s.ox, hy + s.oy, s.r, 0, Math.PI * 2);
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
  }, [density]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />;
}
