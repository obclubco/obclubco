"use client";

import Link from "next/link";
import { Avatar, AvatarStack } from "@/components/Avatar";
import { CountUp } from "@/components/CountUp";
import { DateTile, EventCard } from "@/components/EventCard";
import { GuestCard } from "@/components/GuestCard";
import { useMe } from "@/components/GuestGate";
import { Arrow, EyeOff, MapPin } from "@/components/Icons";
import { ProgressBar } from "@/components/ProgressBar";
import { SplitWords } from "@/components/SplitWords";
import { ErrorState, Loading } from "@/components/States";
import { eventStatus, fromNow, timeRange } from "@/lib/format";
import { useLoad, usePageTitle } from "@/lib/hooks";
import {
  byMostRecent,
  getMyEvents,
  getNetwork,
  guestNote,
  profileChecklist,
  roleLine,
  sharedWith,
  type Guest,
  type Me,
  type NetEvent,
} from "@/lib/network";

const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

export default function HomePage() {
  const me = useMe();
  usePageTitle("Home");
  const { data, error } = useLoad(() => Promise.all([getMyEvents(), getNetwork()]), []);
  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;

  const [events, network] = data;
  const eventsById = new Map(events.map((e) => [e.id, e]));
  const mine = events.filter((e) => e.attending);
  const visited = mine.filter((e) => eventStatus(e) === "past");
  const upcoming = mine.filter((e) => eventStatus(e) !== "past").reverse();
  const next = upcoming[0];
  const met = network.filter((g) => sharedWith(g, eventsById).lastMet).sort(byMostRecent(eventsById));
  const firstName = me.full_name.split(" ")[0];

  const summary =
    mine.length === 0
      ? "The events you go to and the people you meet there will show up here."
      : `You've been to ${visited.length} OB Club ${visited.length === 1 ? "event" : "events"} and met ${met.length} ${met.length === 1 ? "guest" : "guests"}.${next ? ` Next up: ${next.title}, ${fromNow(next.starts_at)}.` : ""}`;

  return (
    <div className="container-x py-12 sm:py-16">
      <section className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end">
        <div className="min-w-0">
          <p className="eyebrow enter">OBC Networking</p>
          <h1 className="display mt-4 text-5xl sm:text-6xl">
            <SplitWords text={`Welcome, ${firstName}.`} delay={100} step={90} />
          </h1>
          <p className="enter mt-4 max-w-lg text-mute" style={d(400)}>
            {summary}
          </p>
        </div>
        <dl
          data-reveal
          className="glow-card glow-inset grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line text-center"
        >
          {(
            [
              ["Events", visited.length],
              ["Guests met", met.length],
              ["Upcoming", upcoming.length],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="bg-surface px-3 py-5">
              <dd className="display text-4xl">
                <CountUp value={value} />
              </dd>
              <dt className="mt-1 text-[11px] uppercase tracking-widest text-mute">{label}</dt>
            </div>
          ))}
        </dl>
      </section>

      {next && <NextUp event={next} guests={network.filter((g) => g.event_ids.includes(next.id))} />}

      <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="min-w-0">
          <SectionHead title="Your Events" href="/events/" link={mine.length > 3 ? "All events" : "Events"} />
          {mine.length === 0 ? (
            <Empty>After your first OB Club event it&apos;ll be listed here, with everyone who was there.</Empty>
          ) : (
            <div className="grid gap-4">
              {(visited.length ? visited : upcoming).slice(0, 3).map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </section>
        <aside className="min-w-0">
          <SectionHead title="Your Profile" href="/profile/" link="Edit" />
          <ProfileCard me={me} />
        </aside>
      </div>

      <section className="mt-16">
        <SectionHead title="People You've Met" href="/guests/" link={network.length ? "All guests" : undefined} />
        {met.length === 0 ? (
          <Empty>
            {network.length
              ? "You'll meet the people on your upcoming guest lists soon. Have a look at who's coming."
              : "Once you've been to an event, the other guests show up here, so you can look them up afterwards."}
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {met.slice(0, 6).map((g) => (
              <GuestCard key={g.id} guest={g} note={guestNote(g, eventsById)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionHead({ title, href, link }: { title: string; href: string; link?: string }) {
  return (
    <div data-reveal className="mb-6 flex items-baseline justify-between gap-4 border-b border-line pb-4">
      <h2 className="display text-3xl">{title}</h2>
      {link && (
        <Link href={href} className="group inline-flex items-center gap-2 text-sm text-mute transition hover:text-bone">
          {link} <Arrow className="size-3.5 transition group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p data-reveal className="card grain p-6 text-sm leading-6 text-mute">
      {children}
    </p>
  );
}

/** The next event on the guest's calendar, with who else is coming. */
function NextUp({ event, guests }: { event: NetEvent; guests: Guest[] }) {
  const live = eventStatus(event) === "live";
  return (
    <Link
      href={`/event/?id=${event.id}`}
      data-reveal
      className="card glow-card lift group mt-14 flex flex-col gap-6 p-6 hover:border-bone/25 sm:flex-row sm:items-center sm:p-8"
    >
      <DateTile iso={event.starts_at} className="w-20 py-3" />
      <div className="min-w-0 flex-1">
        <p className="eyebrow">{live ? "Happening now" : `Next up · ${fromNow(event.starts_at)}`}</p>
        <h2 className="display mt-3 text-3xl sm:text-4xl">{event.title}</h2>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mute">
          <span>{timeRange(event.starts_at, event.ends_at)}</span>
          {event.location && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" /> {event.location}
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center justify-between gap-5 sm:justify-end">
        {guests.length > 0 && (
          <div className="flex items-center gap-3">
            <AvatarStack people={guests} />
            <span className="text-xs text-mute">{guests.length} going</span>
          </div>
        )}
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-ink transition duration-500 ease-smooth group-hover:-rotate-45 group-hover:scale-110 group-hover:shadow-[0_0_30px_-4px_rgb(255_255_255/0.6)]">
          <Arrow />
        </span>
      </div>
    </Link>
  );
}

/** The guest's own profile at a glance, with a nudge to complete it. */
function ProfileCard({ me }: { me: Me }) {
  const checklist = profileChecklist(me);
  const done = checklist.filter((c) => c.done).length;
  const missing = checklist.filter((c) => !c.done).map((c) => c.label);
  const line = roleLine(me);
  return (
    <Link href="/profile/" data-reveal className="card glow-card lift group flex flex-col gap-6 p-6 hover:border-bone/25">
      <div className="flex items-center gap-4">
        <Avatar name={me.full_name} url={me.photo_url} size="md" />
        <div className="min-w-0">
          <p className="truncate font-medium">{me.full_name}</p>
          <p className="truncate text-xs text-mute">{line || "Add your role and company"}</p>
        </div>
      </div>
      <div>
        <div className="mb-3 flex justify-between text-xs text-mute">
          <span>Profile</span>
          <span>{Math.round((done / checklist.length) * 100)}% complete</span>
        </div>
        <ProgressBar value={(done / checklist.length) * 100} />
        <p className="mt-4 text-xs leading-5 text-mute">
          {missing.length
            ? `Add ${missing.slice(0, 2).join(" and ")} so people remember you.`
            : "Looking good. Guests you meet can see who you are and how to reach you."}
        </p>
        {!me.is_visible && (
          <p className="mt-3 flex items-center gap-2 text-xs text-bone/80">
            <EyeOff className="size-3.5" /> Hidden from other guests
          </p>
        )}
      </div>
      <span className="inline-flex items-center gap-2 text-sm text-bone transition group-hover:text-accent">
        Edit profile <Arrow />
      </span>
    </Link>
  );
}
