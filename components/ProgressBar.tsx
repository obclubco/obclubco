export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`h-1 w-full overflow-hidden rounded-full bg-line ${className}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="bar-grow h-full rounded-full bg-accent shadow-[0_0_12px_rgb(255_255_255/0.45)] transition-all duration-700 ease-smooth" style={{ width: `${pct}%` }} />
    </div>
  );
}
