"use client";

import { useEffect } from "react";

/**
 * Page-wide motion, mounted once in the root layout:
 * - reveals [data-reveal] elements as they scroll into view (items that appear together are staggered),
 * - moves the background spotlight (--mx / --my) after the cursor with a soft lag,
 * - tells .glow-card elements where the cursor is (--x / --y),
 * - marks <html data-scrolled> once the page is scrolled (the nav turns solid).
 */
export function Motion() {
  useEffect(() => {
    const root = document.documentElement;
    const reduceMotion = false; // Animations always run, even when the device asks for reduced motion.

    // Scroll reveals
    const io = new IntersectionObserver(
      (entries) => {
        const shown = entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target as HTMLElement)
          .sort((a, b) => {
            const ra = a.getBoundingClientRect();
            const rb = b.getBoundingClientRect();
            return ra.top - rb.top || ra.left - rb.left;
          });
        shown.forEach((el, i) => {
          el.style.setProperty("--auto-d", `${Math.min(i, 8) * 90}ms`);
          el.setAttribute("data-revealed", "");
          io.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -6% 0px" },
    );
    const scan = () => {
      document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-observed])").forEach((el) => {
        el.setAttribute("data-observed", "");
        if (reduceMotion) el.setAttribute("data-revealed", "");
        else io.observe(el);
      });
    };
    scan();
    let scanQueued = 0;
    const mo = new MutationObserver(() => {
      if (!scanQueued) scanQueued = requestAnimationFrame(() => ((scanQueued = 0), scan()));
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Cursor spotlight + card glow
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let hot = false;
    let raf = 0;
    let last = 0;
    const setSpot = () => {
      root.style.setProperty("--mx", `${cx.toFixed(1)}px`);
      root.style.setProperty("--my", `${cy.toFixed(1)}px`);
    };
    const follow = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const k = 1 - Math.exp(-dt * 9);
      cx += (tx - cx) * k;
      cy += (ty - cy) * k;
      setSpot();
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.4 ? requestAnimationFrame(follow) : 0;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      tx = e.clientX;
      ty = e.clientY;
      if (!hot) {
        hot = true;
        cx = tx;
        cy = ty;
        setSpot();
        root.style.setProperty("--hot", "1");
      }
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(follow);
      }
      const card = (e.target as Element | null)?.closest?.(".glow-card") as HTMLElement | null;
      if (card) {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--x", `${e.clientX - r.left}px`);
        card.style.setProperty("--y", `${e.clientY - r.top}px`);
      }
    };
    const onLeave = (e: MouseEvent) => {
      if (e.relatedTarget) return;
      hot = false;
      root.style.setProperty("--hot", "0");
    };
    if (!reduceMotion) {
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("mouseout", onLeave);
    }

    // Solid nav after scrolling
    const onScroll = () => root.toggleAttribute("data-scrolled", window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      cancelAnimationFrame(raf);
      cancelAnimationFrame(scanQueued);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("mouseout", onLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}
