"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StatusPill } from "@/components/EventCard";
import { GuestCard } from "@/components/GuestCard";
import { useMe } from "@/components/GuestGate";
import { GuestListManager } from "@/components/GuestListManager";
import { Calendar, Clock, MapPin, Users } from "@/components/Icons";
import { SearchInput } from "@/components/SearchInput";
import { SplitWords } from "@/components/SplitWords";
import { ErrorState, Loading, NotFoundState } from "@/components/States";
import { eventStatus, formatDate, safeUrl, timeRange } from "@/lib/format";
import { useLoad, usePageTitle } from "@/lib/hooks";
import { getMyEvents, getNetwork, matchesQuery, sharedWith } from "@/lib/network";

export default function EventPage() {
  return (
    <Suspense fallback={<Loading />}>
      <EventDetail />
    </Suspense>
  );
}

const HEADINGS = { upcoming: "Who's Coming", live: "Who's Here", past: "Who Was There" };

function EventDetail() {
  const id = useSearchParams().get("id") ?? "";
  const me = useMe();
  const [query, setQuery] = useState("");
  const { data, error, reload } = useLoad(() => Promise.all([getMyEvents(), getNetwork()]), [id]);
  const event = data?.[0].find((e) => e.id === id);
  usePageTitle(event?.title);

  if (error) return <ErrorState message={error} />;
  // Keep showing the page while it refreshes (e.g. after an admin edits the guest list).
  if (!data) return <Loading />;
  if (!event) return <NotFoundState label="Event not found." />;

  const [events, network] = data;
  const eventsById = new Map(events.map((e) => [e.id, e]));
  const guests = network.filter((g) => g.event_ids.includes(event.id));
  const shown = guests.filter((g) => matchesQuery(g, query));
  const status = eventStatus(event);
  // Who's on the list stays private until the event is over (the database doesn't send it before then).
  const listPrivate = status !== "past" && !me.is_admin;
  const total = guests.length + (event.attending ? 1 : 0);
  const cover = safeUrl(event.cover_image_url);

  // How else you know each guest, e.g. "3 events together".
  const note = (g: (typeof guests)[number]) => {
    const n = sharedWith(g, eventsById).together.length;
    return n > 1 ? `${n} events together` : undefined;
  };

  return (
    <div className="container-x py-12 sm:py-16">
      <Link href="/events/" className="enter text-sm text-mute transition hover:text-bone">
        ← {me.is_admin ? "All events" : "Your events"}
      </Link>

      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt=""
          className="enter mt-8 aspect-[21/9] w-full rounded-2xl border border-line object-cover"
          style={{ "--d": "100ms" } as React.CSSProperties}
        />
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <section className="min-w-0">
          <div className="enter flex flex-wrap items-center gap-2" style={{ "--d": "150ms" } as React.CSSProperties}>
            <StatusPill event={event} />
            {!event.is_published && (
              <span className="rounded-full bg-elevated px-3 py-1 text-[10px] uppercase tracking-widest text-accent">
                Draft · only admins see it
              </span>
            )}
          </div>
          <h1 className="display mt-6 text-5xl sm:text-6xl">
            <SplitWords text={event.title} delay={200} step={90} />
          </h1>
          {event.description && (
            <p
              className="enter mt-6 max-w-2xl whitespace-pre-line leading-relaxed text-bone/85"
              style={{ "--d": "500ms" } as React.CSSProperties}
            >
              {event.description}
            </p>
          )}
        </section>

        <dl data-reveal className="card glow-card divide-y divide-line bg-surface/80 backdrop-blur">
          {[
            { icon: <Calendar className="size-4" />, label: "Date", value: formatDate(event.starts_at, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) },
            { icon: <Clock />, label: "Time", value: timeRange(event.starts_at, event.ends_at) },
            ...(event.location ? [{ icon: <MapPin />, label: "Where", value: event.location }] : []),
            // Before the event is over, guests don't see the guest list or how many are on it.
            ...(listPrivate ? [] : [{ icon: <Users className="size-4" />, label: "Guests", value: `${total} ${total === 1 ? "guest" : "guests"}` }]),
          ].map((row) => (
            <div key={row.label} className="flex items-start gap-4 px-6 py-4">
              <span className="mt-0.5 text-mute">{row.icon}</span>
              <div className="min-w-0">
                <dt className="text-[11px] uppercase tracking-widest text-mute">{row.label}</dt>
                <dd className="mt-1 text-sm text-bone/90">{row.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>

      {listPrivate ? (
        <section className="mt-16">
          <h2 data-reveal className="display border-b border-line pb-5 text-4xl">
            {HEADINGS[status]}
          </h2>
          <p data-reveal className="card grain mt-6 max-w-2xl p-6 text-sm leading-6 text-mute">
            {event.attending && <span className="text-bone">You&apos;re on the list. </span>}
            Who else is coming stays private until the event is over. Then you&apos;ll see who was there on this page
            and under Guests.
          </p>
        </section>
      ) : (
        <section className="mt-16">
          <div
            data-reveal
            className="flex flex-col gap-5 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between"
          >
            <h2 className="display text-4xl">
              {HEADINGS[status]} <span className="text-mute">{total}</span>
            </h2>
            {guests.length > 5 && (
              <SearchInput value={query} onChange={setQuery} placeholder="Search guests" className="sm:w-72" />
            )}
          </div>

          {total === 0 ? (
            <p className="mt-6 text-sm text-mute">Nobody on the guest list yet.</p>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {event.attending && !query && <GuestCard guest={me} href="/profile/" badge="You" />}
              {shown.map((g) => (
                <GuestCard key={g.id} guest={g} note={note(g)} />
              ))}
            </div>
          )}
          {query && shown.length === 0 && <p className="mt-6 text-sm text-mute">No guests match “{query}”.</p>}
        </section>
      )}

      {me.is_admin && <GuestListManager key={event.id} event={event} guests={guests} onChange={reload} />}
    </div>
  );
}
