"use client";

import { useState } from "react";
import { GuestCard } from "@/components/GuestCard";
import { useMe } from "@/components/GuestGate";
import { ChevronDown } from "@/components/Icons";
import { SearchInput } from "@/components/SearchInput";
import { SplitWords } from "@/components/SplitWords";
import { ErrorState, Loading } from "@/components/States";
import { formatDate } from "@/lib/format";
import { useLoad, usePageTitle } from "@/lib/hooks";
import { byMostRecent, getMyEvents, getNetwork, guestNote, matchesQuery } from "@/lib/network";

export default function GuestsPage() {
  const me = useMe();
  usePageTitle("Guests");
  const [query, setQuery] = useState("");
  const [eventId, setEventId] = useState("");
  const { data, error } = useLoad(() => Promise.all([getMyEvents(), getNetwork()]), []);
  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;

  const [events, network] = data;
  const eventsById = new Map(events.map((e) => [e.id, e]));
  const people = [...network].sort(byMostRecent(eventsById));
  const shown = people.filter((g) => (!eventId || g.event_ids.includes(eventId)) && matchesQuery(g, query));
  const filterEvents = events.filter((e) => network.some((g) => g.event_ids.includes(e.id)));

  return (
    <div className="container-x py-12 sm:py-16">
      <p className="eyebrow enter">{me.is_admin ? "All guests" : "Your network"}</p>
      <h1 className="display mt-4 text-5xl sm:text-6xl">
        <SplitWords text={me.is_admin ? "Everyone on the List." : "The People You've Met."} delay={100} step={90} />
      </h1>
      <p className="enter mt-4 max-w-xl text-mute" style={{ "--d": "400ms" } as React.CSSProperties}>
        {network.length === 0
          ? "Once you've been to an OB Club event, the other guests show up here: what they do, what they're looking for and how to reach them."
          : `${network.length} ${network.length === 1 ? "guest" : "guests"} from ${filterEvents.length} ${filterEvents.length === 1 ? "event" : "events"}${me.is_admin ? "" : " you've been to"}. Search by name, company, city or interest.`}
      </p>

      {network.length > 0 && (
        <div className="enter mt-10 flex flex-col gap-3 sm:flex-row" style={{ "--d": "550ms" } as React.CSSProperties}>
          <SearchInput value={query} onChange={setQuery} placeholder="Search guests" className="flex-1" />
          {filterEvents.length > 1 && (
            <div className="relative sm:w-72">
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                aria-label="Filter by event"
                className="input cursor-pointer appearance-none truncate pr-11"
              >
                <option value="">All events</option>
                {filterEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} · {formatDate(e.starts_at, { month: "short", year: "numeric" })}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-mute" />
            </div>
          )}
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((g) => (
          <GuestCard key={g.id} guest={g} note={guestNote(g, eventsById)} />
        ))}
      </div>
      {network.length > 0 && shown.length === 0 && (
        <p className="mt-6 text-sm text-mute">Nobody matches that search.</p>
      )}
    </div>
  );
}
