import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-baseline gap-2">
      <span className="display text-2xl text-bone">OB Club</span>
      <span className="eyebrow text-[10px] text-mute transition group-hover:text-gold">Partners</span>
    </Link>
  );
}
