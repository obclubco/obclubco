import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { Arrow } from "@/components/Icons";
import { createClient } from "@/lib/supabase/server";

const TRACKS = [
  {
    n: "01",
    title: "Sales",
    body: "Prospecting, discovery calls, objection handling and closing. The playbooks our members use to turn conversations into revenue.",
  },
  {
    n: "02",
    title: "Business Building",
    body: "Offers, pricing, systems and hiring. How ambitious operators go from first client to a company that runs without them.",
  },
  {
    n: "03",
    title: "Personal Branding",
    body: "Positioning, content and reputation. Build the kind of name that opens doors before you knock.",
  },
];

const STEPS = [
  { title: "Watch", body: "Short, focused video lessons from founders and operators in the club." },
  { title: "Answer", body: "A few questions after every lesson to lock in what matters." },
  { title: "Unlock", body: "Pass the check and the next lesson opens. Track your progress as you go." },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const cta = user ? { href: "/dashboard", label: "Go to your courses" } : { href: "/login", label: "Partner login" };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="container-x flex h-20 items-center justify-between">
          <Logo />
          <Link href={cta.href} className="btn-ghost px-5 py-2.5">
            {user ? "Dashboard" : "Log in"}
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="grain relative overflow-hidden border-b border-line/70">
          <div className="container-x flex min-h-[88dvh] flex-col justify-center pb-20 pt-36">
            <p className="eyebrow">OB Club · Partnership Program</p>
            <h1 className="display mt-6 max-w-4xl text-[clamp(3rem,9vw,7.5rem)]">
              Learn from the room.
              <br />
              <em className="text-gold">Build</em> with the club.
            </h1>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-mute sm:text-lg">
              A private learning space for OB Club partners. Master sales, business building and personal branding with
              video lessons from the builders, founders and operators in our ecosystem.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link href={cta.href} className="btn-primary">
                {cta.label} <Arrow />
              </Link>
              <a href="#tracks" className="btn-ghost">
                What you&apos;ll learn
              </a>
            </div>
            <p className="mt-6 text-xs text-mute/80">By invitation only. Access is granted by the OB Club team.</p>
          </div>
        </section>

        {/* Tracks */}
        <section id="tracks" className="container-x py-24 sm:py-32">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">The curriculum</p>
              <h2 className="display mt-4 text-5xl sm:text-6xl">Three disciplines.</h2>
            </div>
            <p className="max-w-md text-mute">
              Everything a partner needs to sell with confidence, build something durable and be known for it.
            </p>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
            {TRACKS.map((t) => (
              <article key={t.n} className="group bg-surface p-8 transition hover:bg-elevated sm:p-10">
                <span className="font-display text-lg text-gold">{t.n}</span>
                <h3 className="display mt-10 text-4xl">{t.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-mute">{t.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-line/70 bg-surface/40">
          <div className="container-x grid gap-12 py-24 sm:py-32 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="eyebrow">How it works</p>
              <h2 className="display mt-4 text-5xl sm:text-6xl">
                Watch. Answer. <em className="text-gold">Unlock.</em>
              </h2>
            </div>
            <ol className="space-y-px overflow-hidden rounded-2xl border border-line bg-line">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-6 bg-ink p-7 sm:p-8">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border border-gold/40 font-display text-lg text-gold">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-lg font-medium">{s.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-mute">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CTA */}
        <section className="container-x py-24 text-center sm:py-32">
          <h2 className="display mx-auto max-w-3xl text-5xl sm:text-7xl">
            Your seat is <em className="text-gold">waiting.</em>
          </h2>
          <p className="mx-auto mt-6 max-w-md text-mute">
            Partners sign in with the email address the OB Club team has approved.
          </p>
          <Link href={cta.href} className="btn-gold mt-10">
            {cta.label} <Arrow />
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}
