"use client";

import Link from "next/link";
import { Arrow } from "@/components/Icons";
import { PublicShell } from "@/components/PublicShell";
import { SplitWords } from "@/components/SplitWords";
import { useLoad, usePageTitle } from "@/lib/hooks";
import { getCatalog } from "@/lib/public";
import { isConfigured } from "@/lib/supabase";
import { CATEGORY_LABEL, type Category } from "@/lib/types";

const TRACKS: { category: Category; n: string; body: string }[] = [
  {
    category: "sales",
    n: "01",
    body: "Prospecting, discovery calls, objection handling and closing. The playbooks our members use to turn conversations into revenue.",
  },
  {
    category: "business",
    n: "02",
    body: "Offers, pricing, systems and hiring. How ambitious operators go from first client to a company that runs without them.",
  },
  {
    category: "personal_branding",
    n: "03",
    body: "Positioning, content and reputation. Build the kind of name that opens doors before you knock.",
  },
];

const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

export default function AboutPage() {
  usePageTitle("About");
  const catalog = useLoad(() => (isConfigured ? getCatalog() : Promise.resolve([])), []);
  const courses = catalog.data ?? [];

  return (
    <PublicShell>
      <section className="container-x flex flex-col items-center pb-16 pt-16 text-center sm:pt-24">
        <span className="pill pill-beam enter" style={d(100)}>
          <span className="dot-ping size-1.5 rounded-full bg-bone" /> About the program
        </span>
        <h1 className="display mt-8 max-w-4xl text-[clamp(2.4rem,6vw,4.4rem)] font-bold text-balance">
          <SplitWords text="Built By Operators. For Partners Who Build." delay={250} step={75} />
        </h1>
        <p className="enter mt-7 max-w-2xl text-[15px] leading-7 text-bone/75" style={d(850)}>
          The OBC Partnership Program is a private library of video courses from the founders and operators in the OB
          Club ecosystem. Every lesson is short and practical, ends with a few questions to lock in what matters, and
          unlocks the next one when you pass.
        </p>
      </section>

      <section className="container-x pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          {TRACKS.map((t) => (
            <article key={t.n} data-reveal className="card glow-card bg-surface/80 p-8 backdrop-blur">
              <span className="text-xs tracking-[0.25em] text-mute">{t.n}</span>
              <h2 className="display mt-10 text-3xl">{CATEGORY_LABEL[t.category]}</h2>
              <p className="mt-4 text-sm leading-6 text-mute">{t.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container-x pb-24">
        <div className="flex flex-col items-center text-center">
          <span className="pill" data-reveal>
            <span className="size-1.5 rounded-full bg-bone" /> The courses
          </span>
          <h2 className="display mt-6 text-4xl sm:text-5xl">
            <SplitWords text="What You'll Learn." on="scroll" delay={100} step={110} />
          </h2>
        </div>

        {catalog.loading ? (
          <div className="mt-14 grid place-items-center">
            <span className="spinner" role="status" aria-label="Loading" />
          </div>
        ) : courses.length === 0 ? (
          <p data-reveal className="mx-auto mt-10 max-w-md text-center text-sm leading-6 text-mute">
            New courses are being prepared. Check back soon.
          </p>
        ) : (
          <div className="mx-auto mt-14 grid max-w-5xl gap-4 sm:grid-cols-2">
            {courses.map((c) => (
              <article key={c.slug} data-reveal className="card glow-card flex flex-col bg-surface/80 p-7 backdrop-blur">
                <p className="eyebrow">{CATEGORY_LABEL[c.category]}</p>
                <h3 className="display mt-4 text-2xl sm:text-3xl">{c.title}</h3>
                {c.subtitle && <p className="mt-2 text-sm text-bone/80">{c.subtitle}</p>}
                {c.description && <p className="mt-4 line-clamp-4 text-sm leading-6 text-mute">{c.description}</p>}
                <p className="mt-auto pt-6 text-xs tracking-wide text-mute">
                  {c.lessons > 0 ? `${c.lessons} ${c.lessons === 1 ? "lesson" : "lessons"}` : "Lessons coming soon"}
                  {c.minutes > 0 && ` · ${c.minutes} min`}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="container-x pb-28 text-center">
        <h2 className="display mx-auto max-w-3xl text-4xl sm:text-5xl">
          <SplitWords text="Already a Partner?" on="scroll" step={110} />
        </h2>
        <div data-reveal className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-primary">
            Log in <Arrow />
          </Link>
          <Link href="/coaches/" className="btn-ghost">
            Meet the coaches <Arrow />
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
