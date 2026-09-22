"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Backdrop } from "@/components/Backdrop";
import { Footer } from "@/components/Footer";
import { LoginForm } from "@/components/LoginForm";
import { NavButton, SiteNav } from "@/components/SiteNav";
import { SplitWords } from "@/components/SplitWords";
import { usePageTitle } from "@/lib/hooks";
import { isConfigured, supabase } from "@/lib/supabase";

const STEPS = [
  { title: "Watch", body: "Short, focused video lessons from founders and operators in the club." },
  { title: "Answer", body: "A few questions after every lesson to lock in what matters." },
  { title: "Unlock", body: "Pass the check and the next lesson opens. Track your progress as you go." },
];

/** Where to go after signing in. Only same-site paths, and never back to the login page itself. */
function safeNext(next: string | null) {
  const ok = next?.startsWith("/") && !next.startsWith("//") && next !== "/" && !next.startsWith("/?") && !next.startsWith("/login");
  return ok ? next! : "/dashboard/";
}

/** The site's first page: partner sign-in, styled like the obclub.co hero. */
export function LoginScreen() {
  usePageTitle("Log in");
  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <Backdrop />
      <SiteNav
        links={[{ href: "#how-it-works", label: "How it works" }]}
        cta={<NavButton href="https://www.obclub.co">Visit OBC</NavButton>}
      />

      <main className="flex-1">
        <section className="container-x flex flex-col items-center pb-16 pt-16 text-center sm:pt-24">
          <span className="pill pill-beam enter" style={{ "--d": "150ms" } as React.CSSProperties}>
            <span className="dot-ping size-1.5 rounded-full bg-bone" /> The OBC Partnership Program
          </span>
          <h1 className="display mt-8 max-w-4xl text-[clamp(2.6rem,6.4vw,4.6rem)] font-bold text-balance">
            <SplitWords text="Learn From Builders. Sell, Scale, and Stand Out." delay={300} step={75} />
          </h1>
          <p
            className="enter mt-7 max-w-xl text-[15px] leading-7 text-bone/75"
            style={{ "--d": "900ms" } as React.CSSProperties}
          >
            A private learning space for OBC partners. Sign in with the email the OBC team approved and we&apos;ll
            send you a secure link.
          </p>
          <div className="enter mt-10 w-full max-w-lg" style={{ "--d": "1050ms" } as React.CSSProperties}>
            {isConfigured ? (
              <Suspense>
                <Login />
              </Suspense>
            ) : (
              <p className="card p-6 text-sm text-bad">
                The site isn&apos;t connected to Supabase yet. Add the Supabase settings and redeploy.
              </p>
            )}
          </div>
          <p
            className="enter mt-6 max-w-xs text-xs leading-5 text-mute"
            style={{ "--d": "1200ms" } as React.CSSProperties}
          >
            By invitation only. No password needed. Access is granted by the OBC team.
          </p>
          <a
            href="#how-it-works"
            aria-label="How it works"
            className="enter mt-16 hidden sm:block"
            style={{ "--d": "1600ms" } as React.CSSProperties}
          >
            <span className="scroll-cue" />
          </a>
        </section>

        <section id="how-it-works" className="container-x scroll-mt-24 py-24 sm:py-28">
          <div className="flex flex-col items-center text-center">
            <span className="pill" data-reveal>
              <span className="size-1.5 rounded-full bg-bone" /> How it works
            </span>
            <h2 className="display mt-6 text-4xl sm:text-5xl">
              <SplitWords text="Watch. Answer. Unlock." on="scroll" delay={150} step={120} />
            </h2>
          </div>
          <ol className="mx-auto mt-14 grid max-w-5xl gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} data-reveal className="card glow-card bg-surface/80 p-8 backdrop-blur">
                <span className="grid size-10 place-items-center rounded-full border border-line text-sm text-bone">
                  {i + 1}
                </span>
                <h3 className="display mt-8 text-2xl">{s.title}</h3>
                <p className="mt-3 text-sm leading-6 text-mute">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Login() {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));

  // Already signed in? Go straight to the courses.
  useEffect(() => {
    supabase()
      .auth.getSession()
      .then(({ data }) => data.session && router.replace(next));
  }, [next, router]);

  return <LoginForm next={next} initialError={params.get("error") ?? undefined} />;
}
