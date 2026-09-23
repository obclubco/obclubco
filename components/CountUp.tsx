"use client";

import { useEffect, useState } from "react";

/** Counts from 0 up to `value` with an ease-out, e.g. a quiz score. */
export function CountUp({ value, duration = 1100, suffix = "" }: { value: number; duration?: number; suffix?: string }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <>
      {shown}
      {suffix}
    </>
  );
}
