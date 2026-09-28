"use client";

import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DateTile } from "@/components/EventCard";
import { useMe } from "@/components/GuestGate";
import { GuestProfile } from "@/components/GuestProfile";
import { ErrorState, Loading, NotFoundState } from "@/components/States";
import { eventStatus } from "@/lib/format";
import { useLoad, usePageTitle } from "@/lib/hooks";
import { getMyEvents, getNetwork, sharedWith, type NetEvent } from "@/lib/network";

export default function GuestPage() {
  return (
    <Suspense fallback={<Loading />}>
      <GuestDetail />
    </Suspense>
  );
}

function GuestDetail() {
  const id = useSearchParams().get("id") ?? "";
  const me = useMe();
  const router = useRouter();
  const isMe = id === me.id;
  const { data, error } = useLoad(() => Promise.all([getMyEvents(), getNetwork()]), [id]);
  const guest = data?.[1].find((g) => g.id === id);
  usePageTitle(guest?.full_name);

  // Your own profile lives on the Profile page.
  useEffect(() => {
    if (isMe) router.replace("/profile/");
  }, [isMe, router]);

  if (error) return <ErrorState message={error} />;
  if (isMe || !data) return <Loading />;
  if (!guest) return <NotFoundState label="This guest isn't in your network." href="/guests/" cta="Back to guests" />;

  const eventsById = new Map(data[0].map((e) => [e.id, e]));
  const { all, together } = sharedWith(guest, eventsById);
  const listed = me.is_admin ? all : together;

  return (
    <div className="container-x py-12 sm:py-16">
      <Link href="/guests/" className="enter text-sm text-mute transition hover:text-bone">
        ← {me.is_admin ? "All guests" : "Your network"}
      </Link>
      <div className="enter mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px]" style={{ "--d": "100ms" } as React.CSSProperties}>
        <div className="min-w-0">
          <GuestProfile profile={guest} />
        </div>
        <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
          <h2 className="eyebrow mb-4">{me.is_admin ? "Their events" : "Events in common"}</h2>
          <div className="grid gap-3">
            {listed.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function EventRow({ event }: { event: NetEvent }) {
  const status = eventStatus(event);
  return (
    <Link
      href={`/event/?id=${event.id}`}
      data-reveal
      className="card glow-card lift group flex min-w-0 items-center gap-4 p-3 pr-4 hover:border-bone/25"
    >
      <DateTile iso={event.starts_at} className="w-14 py-2" />
      <div className="min-w-0">
        <p className="truncate font-medium">{event.title}</p>
        <p className="mt-0.5 text-xs text-mute">
          {status === "upcoming" ? "Coming up" : status === "live" ? "Happening now" : event.attending ? "You were both there" : "Past event"}
        </p>
      </div>
    </Link>
  );
}
