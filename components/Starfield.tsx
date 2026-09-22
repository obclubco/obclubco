/** Scattered star dots behind a section, as on obclub.co. Deterministic, so server and client markup match. */
export function Starfield({ count = 90, className = "" }: { count?: number; className?: string }) {
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const stars = Array.from({ length: count }, () => ({
    left: rand() * 100,
    top: rand() * 100,
    size: rand() < 0.85 ? 1.5 : 2.5,
    opacity: 0.15 + rand() * 0.55,
    delay: rand() * 6,
    twinkle: rand() < 0.35,
  }));
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
            ["--o" as string]: s.opacity,
            animation: s.twinkle ? `twinkle 5s ease-in-out ${s.delay}s infinite` : undefined,
          }}
        />
      ))}
    </div>
  );
}
