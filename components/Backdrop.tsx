import { Starfield } from "@/components/Starfield";

/**
 * The obclub.co-style page background: breathing top light, faint grid, a spotlight and brighter grid
 * lines around the cursor, and the star field. Place as the first child of a `relative isolate` wrapper.
 * `burst` (ms): the stars fly out from the centre after this delay, for an opening moment.
 */
export function Backdrop({ stars = 1, burst }: { stars?: number; burst?: number }) {
  return (
    <>
      <div aria-hidden className="bg-layer bg-light" />
      <div aria-hidden className="bg-layer bg-grid" />
      <div aria-hidden className="bg-layer bg-grid-hot" />
      <div aria-hidden className="bg-layer bg-glow" />
      <Starfield density={stars} burst={burst} />
    </>
  );
}
