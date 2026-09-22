import { Starfield } from "@/components/Starfield";

/**
 * The obclub.co-style page background: breathing top light, faint grid, a spotlight and brighter grid
 * lines around the cursor, and the star field. Place as the first child of a `relative isolate` wrapper.
 */
export function Backdrop({ stars = 1 }: { stars?: number }) {
  return (
    <>
      <div aria-hidden className="bg-layer bg-light" />
      <div aria-hidden className="bg-layer bg-grid" />
      <div aria-hidden className="bg-layer bg-grid-hot" />
      <div aria-hidden className="bg-layer bg-glow" />
      <Starfield density={stars} />
    </>
  );
}
