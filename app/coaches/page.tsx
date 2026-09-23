"use client";

import Link from "next/link";
import { Arrow } from "@/components/Icons";
import { PublicShell } from "@/components/PublicShell";
import { SplitWords } from "@/components/SplitWords";
import { useLoad, usePageTitle } from "@/lib/hooks";
import { getCoaches, type Coach } from "@/lib/public";
import { isConfigured } from "@/lib/supabase";

const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

/** Only plain web links are shown for portfolio items. */
function safeUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

export default function CoachesPage() {
  usePageTitle("Coaches");
  const coaches = useLoad(() => (isConfigured ? getCoaches() : Promise.resolve([])), []);
  const list = coaches.data ?? [];

  return (
    <PublicShell>
      <section className="container-x flex flex-col items-center pb-16 pt-16 text-center sm:pt-24">
        <span className="pill pill-beam enter" style={d(100)}>
          <span className="dot-ping size-1.5 rounded-full bg-bone" /> The coaches
        </span>
        <h1 className="display mt-8 max-w-4xl text-[clamp(2.4rem,6vw,4.4rem)] font-bold text-balance">
          <SplitWords text="Learn From People Who've Done It." delay={250} step={75} />
        </h1>
        <p className="enter mt-7 max-w-2xl text-[15px] leading-7 text-bone/75" style={d(850)}>
          Every course is taught by a founder or operator from the OB Club ecosystem, people who have sold, built and
          grown the things they teach.
        </p>
      </section>

      <section className="container-x pb-28">
        {coaches.loading ? (
          <div className="grid place-items-center py-10">
            <span className="spinner" role="status" aria-label="Loading" />
          </div>
        ) : list.length === 0 ? (
          <p data-reveal className="mx-auto max-w-md text-center text-sm leading-6 text-mute">
            Our coaches will be introduced here soon.
          </p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {list.map((c) => (
              <CoachCard key={c.id} coach={c} />
            ))}
          </div>
        )}

        <div data-reveal className="mt-20 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-primary">
            Log in <Arrow />
          </Link>
          <Link href="/about/" className="btn-ghost">
            About the program <Arrow />
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}

function CoachCard({ coach }: { coach: Coach }) {
  const initials = coach.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const links = coach.portfolio
    .map((l) => ({ label: l.label, url: safeUrl(l.url) }))
    .filter((l): l is { label: string; url: string } => !!l.url && !!l.label);

  return (
    <article data-reveal className="card glow-card flex flex-col gap-6 bg-surface/80 p-7 backdrop-blur sm:flex-row sm:p-8">
      <div className="shrink-0">
        {coach.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coach.photo_url}
            alt={coach.name}
            className="size-28 rounded-2xl border border-line object-cover grayscale transition duration-700 ease-smooth hover:grayscale-0"
          />
        ) : (
          <div className="grain grid size-28 place-items-center rounded-2xl border border-line">
            <span className="font-display text-3xl font-medium text-bone/70">{initials}</span>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h2 className="display text-3xl">{coach.name}</h2>
        {coach.role && <p className="mt-2 text-xs uppercase tracking-[0.2em] text-mute">{coach.role}</p>}
        {coach.bio && <p className="mt-4 text-sm leading-6 text-bone/85">{coach.bio}</p>}

        {coach.highlights.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2">
            {coach.highlights.map((h) => (
              <li key={h} className="rounded-full border border-line bg-elevated/70 px-3 py-1 text-[11px] text-bone/80">
                {h}
              </li>
            ))}
          </ul>
        )}

        {coach.experience && (
          <div className="mt-6 border-t border-line pt-5">
            <p className="eyebrow">Experience</p>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-mute">{coach.experience}</p>
          </div>
        )}

        {links.length > 0 && (
          <div className="mt-6 border-t border-line pt-5">
            <p className="eyebrow">Portfolio</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost px-4 py-2 text-xs"
                >
                  {l.label} <span aria-hidden>↗</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
