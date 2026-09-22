type P = { className?: string };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Check = ({ className = "size-4" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const Lock = ({ className = "size-4" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 118 0v3" /></svg>
);
export const Play = ({ className = "size-4" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M8 5.5v13l10.5-6.5z" /></svg>
);
export const Arrow = ({ className = "size-4" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
