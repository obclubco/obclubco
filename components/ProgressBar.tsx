export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`h-1 w-full overflow-hidden rounded-full bg-line ${className}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gold transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}
