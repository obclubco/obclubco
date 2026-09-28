"use client";

import { EventCard } from "@/components/EventCard";
import { useMe } from "@/components/GuestGate";
import { SplitWords } from "@/components/SplitWords";
import { ErrorState, Loading } from "@/components/States";
import { eventStatus } from "@/lib/format";
import { useLoad, usePageTitle } from "@/lib/hooks";
import { getMyEvents, type NetEvent } from "@/lib/network";

export default function EventsPage() {
  const me = useMe();
  usePageTitle("Events");
  const { data: events, error } = useLoad(getMyEvents, []);
  if (error) return <ErrorState message={error} />;
  if (!events) return <Loading />;

  const upcoming = events.filter((e) => eventStatus(e) !== "past").reverse();
  const past = events.filter((e) => eventStatus(e) === "past");
  const visited = past.filter((e) => e.attending).length;
  // Admins see every event; say which ones they're on the list for.
  const note = (e: NetEvent) =>
    me.is_admin && e.attending ? (eventStatus(e) === "past" ? "you were there" : "you're on the list") : undefined;

  return (
    <div className="container-x py-12 sm:py-16">
      <p className="eyebrow enter">{me.is_admin ? "All events" : "Your events"}</p>
      <h1 className="display mt-4 text-5xl sm:text-6xl">
        <SplitWords text={me.is_admin ? "Every Event." : "Where You've Been."} delay={100} step={90} />
      </h1>
      <p className="enter mt-4 max-w-lg text-mute" style={{ "--d": "400ms" } as React.CSSProperties}>
        {events.length === 0
          ? "No events yet. After your first OB Club event it'll be listed here, with everyone who was there."
          : me.is_admin
            ? `${events.length} ${events.length === 1 ? "event" : "events"}, ${upcoming.length} coming up. Open one to see and manage its guest list.`
            : `You've been to ${visited} ${visited === 1 ? "event" : "events"}${upcoming.length ? ` and you're on the list for ${upcoming.length} more` : ""}. Open one to see who was there.`}
      </p>

      {upcoming.length > 0 && (
        <section className="mt-14">
          <h2 data-reveal className="mb-6 border-b border-line pb-4 text-sm text-mute">
            Coming up
          </h2>
          <div className="grid gap-4">
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} note={note(e)} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="mt-14">
          <h2 data-reveal className="mb-6 border-b border-line pb-4 text-sm text-mute">
            {me.is_admin ? "Past events" : "Visited"}
          </h2>
          <div className="grid gap-4">
            {past.map((e) => (
              <EventCard key={e.id} event={e} note={note(e)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
