"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ApplyForm } from "@/components/ApplyForm";
import { Backdrop } from "@/components/Backdrop";
import { Footer } from "@/components/Footer";
import { Calendar, Clock } from "@/components/Icons";
import { NavButton, SiteNav } from "@/components/SiteNav";
import { SplitWords } from "@/components/SplitWords";
import { ErrorState, Loading } from "@/components/States";
import { getOpenEvents, type OpenEvent } from "@/lib/applications";
import { formatDate, safeUrl, timeRange } from "@/lib/format";
import { useLoad, usePageTitle } from "@/lib/hooks";
import { isConfigured } from "@/lib/supabase";

const at = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

/**
 * The public application page (/apply/, no login). /apply/?event=… applies for that event; without it the
 * page offers every event taking applications, or a general application when none is.
 */
export function ApplyScreen() {
  usePageTitle("Apply");
  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <Backdrop />
      <SiteNav cta={<NavButton href="/">Log in</NavButton>} />
      <main id="main" className="flex-1">
        {isConfigured ? (
          <Suspense fallback={<Loading />}>
            <Apply />
          </Suspense>
        ) : (
          <p className="card mx-auto mt-16 max-w-sm p-6 text-center text-sm text-bad">
            The site isn&apos;t connected to Supabase yet. Add the Supabase settings and redeploy.
          </p>
        )}
      </main>
      <Footer />
    </div>
  );
}

function Apply() {
  const requested = useSearchParams().get("event")?.toLowerCase() ?? null;
  const { data: events, error } = useLoad(getOpenEvents, []);

  if (error) return <ErrorState message="The application page couldn't load. Check your connection and refresh." />;
  if (!events) return <Loading />;

  const match = requested ? events.find((e) => e.id === requested) : undefined;
  const choices = match ? [match] : events;

  return (
    <section className="container-x pb-20 pt-10 sm:pt-16">
      <div className="mx-auto max-w-xl">
        {requested && !match && (
          <p className="enter card mb-8 px-5 py-4 text-sm text-bone/80">
            Applications for that event have closed, but you can still apply below.
          </p>
        )}
        {choices.length === 1 ? <EventHeader event={choices[0]} /> : <GeneralHeader several={choices.length > 1} />}
        <div className="enter mt-10" style={at(450)}>
          <ApplyForm choices={choices} />
        </div>
        <Privacy />
      </div>
    </section>
  );
}

function EventHeader({ event }: { event: OpenEvent }) {
  const cover = safeUrl(event.cover_image_url);
  return (
    <header>
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt=""
          className="enter mb-8 aspect-[2/1] w-full rounded-2xl border border-line object-cover"
          style={at(0)}
        />
      )}
      <span className="pill enter" style={at(50)}>
        <span className="dot-ping size-1.5 rounded-full bg-bone" /> Applications open
      </span>
      <h1 className="display mt-6 text-[clamp(2.4rem,7vw,3.6rem)] font-bold text-balance">
        <SplitWords text={event.title} delay={150} step={70} />
      </h1>
      <p className="enter mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-bone/80" style={at(300)}>
        <span className="inline-flex items-center gap-2">
          <Calendar className="size-4 text-mute" />
          {formatDate(event.starts_at, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </span>
        <span className="inline-flex items-center gap-2">
          <Clock className="size-4 text-mute" />
          {timeRange(event.starts_at, event.ends_at)}
        </span>
      </p>
      {event.description && (
        <p className="enter mt-5 whitespace-pre-line text-[15px] leading-7 text-bone/75" style={at(350)}>
          {event.description}
        </p>
      )}
    </header>
  );
}

function GeneralHeader({ several }: { several: boolean }) {
  return (
    <header>
      <span className="pill enter" style={at(50)}>
        <span className="dot-ping size-1.5 rounded-full bg-bone" /> OB Club
      </span>
      <h1 className="display mt-6 text-[clamp(2.4rem,7vw,3.6rem)] font-bold text-balance">
        <SplitWords text={several ? "Apply to Join an OB Club Evening" : "Apply to Join OB Club"} delay={150} step={70} />
      </h1>
      <p className="enter mt-5 text-[15px] leading-7 text-bone/75" style={at(300)}>
        {several
          ? "Pick the event, tell us a little about yourself, and we'll get back to you."
          : "Tell us a little about yourself, and we'll get in touch when there's a place for you at one of our events."}
      </p>
    </header>
  );
}

/** What the consent box refers to ("as described at the bottom of this page"). */
function Privacy() {
  const items: [string, string][] = [
    ["What we keep", "Only your answers in this form."],
    ["Who sees them", "Only the OB Club team reviewing applications. Never shared or sold, and no newsletters."],
    ["What for", "Deciding who to invite, and getting back to you about it."],
    [
      "How long",
      "If we don't invite you, we delete your application. If we do, your name and details start your guest profile on this site, which you can edit or hide.",
    ],
    ["Changed your mind?", "Tell us when we get in touch, and we'll delete your application."],
  ];
  return (
    <section id="privacy" className="mt-16 scroll-mt-28 border-t border-line pt-10">
      <h2 className="eyebrow">How we handle your application</h2>
      <dl className="mt-6 grid gap-4 text-sm leading-6">
        {items.map(([term, text]) => (
          <div key={term} className="grid gap-1 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
            <dt className="text-bone">{term}</dt>
            <dd className="text-bone/70">{text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
