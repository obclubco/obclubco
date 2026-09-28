import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { EyeOff, MapPin } from "@/components/Icons";
import { roleLine } from "@/lib/network";

type CardGuest = {
  id: string;
  full_name: string;
  role: string | null;
  company: string | null;
  city: string | null;
  photo_url: string | null;
  interests: string[];
  is_visible?: boolean;
};

/** A guest in a list: photo, name, role and company, a few interests, and an optional note. */
export function GuestCard({
  guest,
  href = `/guest/?id=${guest.id}`,
  note,
  badge,
}: {
  guest: CardGuest;
  href?: string;
  /** e.g. "Met at Founders Dinner" */
  note?: string;
  /** e.g. "You" */
  badge?: string;
}) {
  const line = roleLine(guest);
  return (
    <Link href={href} data-reveal className="card glow-card lift group flex min-w-0 gap-4 p-5 hover:border-bone/25">
      <Avatar name={guest.full_name} url={guest.photo_url} className="transition duration-500 ease-smooth group-hover:border-bone/40" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{guest.full_name}</p>
          {badge && (
            <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-mute">
              {badge}
            </span>
          )}
          {guest.is_visible === false && (
            <span title="Hidden from other guests" className="shrink-0 text-mute">
              <EyeOff className="size-3.5" />
            </span>
          )}
        </div>
        {line && <p className="mt-0.5 truncate text-xs text-bone/70">{line}</p>}
        {guest.city && (
          <p className="mt-1 flex items-center gap-1 truncate text-xs text-mute">
            <MapPin className="size-3.5 shrink-0" /> {guest.city}
          </p>
        )}
        {guest.interests.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {guest.interests.slice(0, 3).map((t) => (
              <li key={t} className="rounded-full border border-line bg-elevated/70 px-2.5 py-0.5 text-[10px] text-bone/75">
                {t}
              </li>
            ))}
            {guest.interests.length > 3 && <li className="px-1 py-0.5 text-[10px] text-mute">+{guest.interests.length - 3}</li>}
          </ul>
        )}
        {note && <p className="mt-3 line-clamp-2 text-[11px] leading-4 tracking-wide text-mute">{note}</p>}
      </div>
    </Link>
  );
}
