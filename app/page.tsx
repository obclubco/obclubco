import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Arrow } from "@/components/Icons";
import { NavButton, SiteNav } from "@/components/SiteNav";
import { Starfield } from "@/components/Starfield";

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

const NAV = [
  { href: "https://www.obclub.co", label: "Home" },
  { href: "#curriculum", label: "Curriculum" },
  { href: "#how-it-works", label: "How it works" },
];

export default function Home() {
  // The login page sends already signed-in partners straight to their courses.
  return (
    <div className="grain relative flex min-h-dvh flex-col">
      <Starfield count={140} />
      <SiteNav links={NAV} cta={<NavButton href="/login/">Partner Login</NavButton>} />

      <main className="relative flex-1">
        {/* Hero */}
        <section className="container-x flex flex-col items-center pb-20 pt-20 text-center sm:pt-28">
          <span className="pill">
            <span className="size-1.5 rounded-full bg-bone" /> The OBC Partnership Program
          </span>
          <h1 className="display mt-8 max-w-4xl font-bold text-[clamp(2.6rem,6.4vw,4.6rem)]">
            Learn From Builders. Sell, Scale, and Stand Out.
          </h1>
          <p className="mt-7 max-w-xl text-[15px] leading-7 text-bone/75">
            A private learning space for OB Club partners. Master sales, business building and personal branding with
            video lessons from the founders and operators in our ecosystem.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/login/" className="btn-primary">
              Partner Login <Arrow />
            </Link>
            <a href="#curriculum" className="btn-ghost">
              View Curriculum <Arrow />
            </a>
          </div>
          <p className="mt-6 max-w-xs text-xs leading-5 text-mute">
            By invitation only. Sign in with the email the OBC team approved. No password needed.
          </p>

          <p className="eyebrow mt-20">What you&apos;ll master</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
            {TRACKS.map((t) => (
              <span key={t.n} className="font-display text-2xl font-medium text-bone/45 sm:text-3xl">
                {t.title}
              </span>
            ))}
          </div>
        </section>

        {/* Curriculum */}
        <section id="curriculum" className="container-x scroll-mt-24 py-24 sm:py-28">
          <div className="flex flex-col items-center text-center">
            <span className="pill">
              <span className="size-1.5 rounded-full bg-bone" /> The curriculum
            </span>
            <h2 className="display mt-6 text-4xl sm:text-5xl">Three Disciplines.</h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-mute">
              Everything a partner needs to sell with confidence, build something durable and be known for it.
            </p>
          </div>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {TRACKS.map((t) => (
              <article key={t.n} className="card bg-surface/80 p-8 backdrop-blur transition hover:border-bone/25">
                <span className="text-xs tracking-[0.25em] text-mute">{t.n}</span>
                <h3 className="display mt-10 text-3xl">{t.title}</h3>
                <p className="mt-4 text-sm leading-6 text-mute">{t.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="container-x scroll-mt-24 py-24 sm:py-28">
          <div className="flex flex-col items-center text-center">
            <span className="pill">
              <span className="size-1.5 rounded-full bg-bone" /> How it works
            </span>
            <h2 className="display mt-6 text-4xl sm:text-5xl">Watch. Answer. Unlock.</h2>
          </div>
          <ol className="mx-auto mt-14 grid max-w-5xl gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="card bg-surface/80 p-8 backdrop-blur">
                <span className="grid size-10 place-items-center rounded-full border border-line text-sm text-bone">
                  {i + 1}
                </span>
                <h3 className="display mt-8 text-2xl">{s.title}</h3>
                <p className="mt-3 text-sm leading-6 text-mute">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* CTA */}
        <section className="container-x py-24 text-center sm:py-32">
          <h2 className="display mx-auto max-w-3xl text-4xl sm:text-6xl">Your Seat Is Waiting.</h2>
          <p className="mx-auto mt-6 max-w-md text-sm leading-6 text-mute">
            Partners sign in with the email address the OBC team has approved.
          </p>
          <Link href="/login/" className="btn-primary mt-10">
            Partner Login <Arrow />
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}
