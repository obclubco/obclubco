import Link from "next/link";
import { Arrow, MapPin } from "@/components/Icons";
import { eventStatus, formatDate, fromNow, safeUrl, timeRange, type EventStatus } from "@/lib/format";
import type { NetEvent } from "@/lib/network";

/** The day of an event as a small calendar tile. */
export function DateTile({ iso, className = "" }: { iso: string; className?: string }) {
  return (
    <div className={`grain flex w-16 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-surface py-2.5 ${className}`}>
      <span className="text-[10px] uppercase tracking-[0.25em] text-mute">{formatDate(iso, { month: "short" })}</span>
      <span className="display mt-0.5 text-3xl leading-none">{formatDate(iso, { day: "numeric" })}</span>
      <span className="mt-1 text-[10px] text-mute">{formatDate(iso, { year: "numeric" })}</span>
    </div>
  );
}

const STATUS_LABEL: Record<EventStatus, string> = { upcoming: "Upcoming", live: "Happening now", past: "Visited" };

/** "Upcoming · in 3 weeks", "Happening now", "Visited" (or "Past" for events you weren't at). */
export function StatusPill({ event }: { event: NetEvent }) {
  const status = eventStatus(event);
  const label =
    status === "past" && !event.attending ? "Past" : status === "upcoming" ? `Upcoming · ${fromNow(event.starts_at)}` : STATUS_LABEL[status];
  return (
    <span className="pill px-3 py-1 text-[10px]">
      <span className={`size-1.5 rounded-full ${status === "past" ? "bg-mute" : "dot-ping bg-bone"}`} /> {label}
    </span>
  );
}

/** An event in a list: date tile, title, time and place, and how many guests. */
export function EventCard({ event, note }: { event: NetEvent; note?: string }) {
  const cover = safeUrl(event.cover_image_url);
  return (
    <Link
      href={`/event/?id=${event.id}`}
      data-reveal
      className="card glow-card lift group flex min-w-0 items-center gap-5 p-4 pr-5 hover:border-bone/25 sm:p-5"
    >
      <DateTile iso={event.starts_at} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill event={event} />
          {!event.is_published && (
            <span className="rounded-full bg-elevated px-2.5 py-1 text-[9px] uppercase tracking-widest text-accent">Draft</span>
          )}
        </div>
        <h3 className="display mt-3 truncate text-2xl sm:text-[1.7rem]">{event.title}</h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mute">
          <span>
            {formatDate(event.starts_at, { weekday: "short" })} · {timeRange(event.starts_at, event.ends_at)}
          </span>
          {event.location && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="size-3.5 shrink-0" /> <span className="truncate">{event.location}</span>
            </span>
          )}
        </p>
        {(event.guest_count !== null || note) && (
          <p className="mt-2 text-[11px] tracking-wide text-bone/70">
            {event.guest_count !== null && `${event.guest_count} ${event.guest_count === 1 ? "guest" : "guests"}`}
            {note && (
              <span className="text-mute">
                {event.guest_count !== null && " · "}
                {note}
              </span>
            )}
          </p>
        )}
      </div>
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt=""
          loading="lazy"
          className="hidden h-20 w-32 shrink-0 rounded-xl border border-line object-cover opacity-80 transition duration-700 ease-smooth group-hover:opacity-100 sm:block"
        />
      )}
      <span className="hidden size-10 shrink-0 place-items-center rounded-full border border-line text-bone transition duration-500 ease-smooth group-hover:-rotate-45 group-hover:border-bone/40 sm:grid">
        <Arrow />
      </span>
    </Link>
  );
}
