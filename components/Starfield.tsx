"use client";

import { useEffect, useRef } from "react";

type Star = {
  x: number; // drifting home position, in CSS px
  y: number;
  vx: number; // drift velocity, px per second
  vy: number;
  ox: number; // current push away from the cursor
  oy: number;
  r: number; // radius
  a: number; // base opacity
  tw: number; // twinkle speed (0 = steady)
  ph: number; // twinkle phase
};

const DRIFT_MIN = 2; // px/s — stars float slowly
const DRIFT_MAX = 7;
const REPEL_RADIUS = 150; // stars within this distance of the cursor move away…
const REPEL_DISTANCE = 26; // …by at most this many px
const EASE = 3; // how quickly stars glide away and back (per second)

/**
 * Background star field, as on obclub.co: slow drift, gentle twinkle,
 * and stars that ease away from the cursor. Static for reduced-motion users.
 * Place inside a container with `isolate` so it sits behind the content.
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
    let pointer: { x: number; y: number } | null = null;
    let raf = 0;
    let last = performance.now();

    const makeStar = (): Star => {
      const angle = Math.random() * Math.PI * 2;
      const speed = DRIFT_MIN + Math.random() * (DRIFT_MAX - DRIFT_MIN);
      const big = Math.random() < 0.15;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ox: 0,
        oy: 0,
        r: big ? 1.1 + Math.random() * 0.5 : 0.55 + Math.random() * 0.45,
        a: 0.2 + Math.random() * 0.6,
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

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now / 1000;
      const k = 1 - Math.exp(-EASE * dt);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#fff";

      for (const s of stars) {
        if (!reduceMotion) {
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          if (s.x < -20) s.x += w + 40;
          else if (s.x > w + 20) s.x -= w + 40;
          if (s.y < -20) s.y += h + 40;
          else if (s.y > h + 20) s.y -= h + 40;

          let tx = 0;
          let ty = 0;
          if (pointer) {
            const dx = s.x - pointer.x;
            const dy = s.y - pointer.y;
            const dist = Math.hypot(dx, dy);
            if (dist < REPEL_RADIUS) {
              const push = (1 - dist / REPEL_RADIUS) ** 2 * REPEL_DISTANCE;
              tx = dist > 0.01 ? (dx / dist) * push : push;
              ty = dist > 0.01 ? (dy / dist) * push : 0;
            }
          }
          s.ox += (tx - s.ox) * k;
          s.oy += (ty - s.oy) * k;
        }

        ctx.globalAlpha = s.tw && !reduceMotion ? s.a * (0.55 + 0.45 * Math.sin(t * s.tw + s.ph)) : s.a;
        ctx.beginPath();
        ctx.arc(s.x + s.ox, s.y + s.oy, s.r, 0, Math.PI * 2);
        ctx.fill();
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
