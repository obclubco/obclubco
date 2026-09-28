"use client";

import { useState } from "react";
import { initials, safeUrl } from "@/lib/format";

const SIZES = {
  "2xs": "size-6 text-[9px]",
  xs: "size-8 text-[11px]",
  sm: "size-11 text-sm",
  md: "size-14 text-base",
  lg: "size-24 text-3xl",
  xl: "size-28 text-4xl sm:size-36 sm:text-5xl",
} as const;

/** A guest's photo in a circle, or their initials when there's no photo (or it doesn't load). Decorative: the name is always shown next to it. */
export function Avatar({
  name,
  url,
  size = "md",
  className = "",
}: {
  name: string;
  url: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const src = safeUrl(url);
  const [failed, setFailed] = useState<string | null>(null);
  const box = `${SIZES[size]} shrink-0 overflow-hidden rounded-full border border-line ${className}`;

  if (src && failed !== src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(src)}
        className={`${box} bg-elevated object-cover object-[50%_30%]`}
      />
    );
  }
  return (
    <span aria-hidden className={`${box} grain grid place-items-center bg-surface`}>
      <span className="font-display font-medium tracking-normal text-bone/75">{initials(name) || "·"}</span>
    </span>
  );
}

/** A row of overlapping avatars, e.g. who's coming to an event. */
export function AvatarStack({ people, total }: { people: { id: string; full_name: string; photo_url: string | null }[]; total?: number }) {
  const shown = people.slice(0, 5);
  const more = (total ?? people.length) - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <Avatar key={p.id} name={p.full_name} url={p.photo_url} size="xs" className={`ring-2 ring-surface ${i ? "-ml-1.5" : ""}`} />
      ))}
      {more > 0 && (
        <span className="-ml-1.5 grid size-8 place-items-center rounded-full border border-line bg-elevated text-[10px] text-bone/80 ring-2 ring-surface">
          +{more}
        </span>
      )}
    </div>
  );
}
