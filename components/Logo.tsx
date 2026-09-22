import Link from "next/link";

/** OBC wordmark as on obclub.co: "EST OBC 2024", plus a Partners tag. */
export function Logo({ href = "/", tag = true }: { href?: string; tag?: boolean }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-3" aria-label="OBC Partners home">
      <span className="inline-flex items-center gap-1 text-bone">
        <span className="text-[6px] tracking-wider text-mute">EST</span>
        <span className="font-display text-xl font-medium leading-none tracking-tight">OBC</span>
        <span className="text-[6px] tracking-wider text-mute">2024</span>
      </span>
      {tag && (
        <span className="hidden rounded-full border border-line px-2 py-0.5 text-[9px] sm:inline uppercase tracking-[0.25em] text-mute transition group-hover:text-bone">
          Partners
        </span>
      )}
    </Link>
  );
}
