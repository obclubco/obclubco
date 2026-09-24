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

/** How long the opening intro plays before the page builds in (keep in sync with .intro in globals.css). */
const INTRO = 1500;
const at = (ms: number) => ({ "--d": `${INTRO + ms}ms` }) as React.CSSProperties;

/** Where to go after logging in. Only same-site paths, and never back to the login page itself. */
function safeNext(next: string | null) {
  const ok = next?.startsWith("/") && !next.startsWith("//") && next !== "/" && !next.startsWith("/?") && !next.startsWith("/login");
  return ok ? next! : "/dashboard/";
}

/** The site's first page: partner log in, styled like the obclub.co hero, with an opening intro. */
export function LoginScreen() {
  usePageTitle("Log in");
  // Drop leftover anchors such as #how-it-works (from an older version of the page) from the address bar.
  useEffect(() => {
    if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);
  return (
    <div
      className="relative isolate flex min-h-dvh flex-col"
      style={{ "--nav-d": `${INTRO}ms` } as React.CSSProperties}
    >
      <Intro />
      <Backdrop stars={1.2} burst={INTRO - 250} />
      <SiteNav cta={<NavButton href="https://www.obclub.co">Visit OBC</NavButton>} />

      <main id="main" className="flex flex-1 flex-col">
        <section className="container-x flex flex-1 flex-col items-center justify-center pb-20 pt-12 text-center sm:pt-16">
          <span className="pill pill-beam enter" style={at(100)}>
            <span className="dot-ping size-1.5 rounded-full bg-bone" /> The OBC Partnership Program
          </span>
          <h1 className="display mt-8 max-w-4xl text-[clamp(2.6rem,6.4vw,4.6rem)] font-bold text-balance">
            <SplitWords text="Learn From Builders. Sell, Scale, and Stand Out." delay={INTRO + 250} step={75} />
          </h1>
          <p className="enter mt-7 max-w-xl text-[15px] leading-7 text-bone/75" style={at(850)}>
            A private learning space for OBC partners. Log in with the email and password the OBC team gave you.
          </p>
          <div className="enter mt-10 w-full" style={at(1000)}>
            {isConfigured ? (
              <Suspense>
                <Login />
              </Suspense>
            ) : (
              <p className="card mx-auto max-w-sm p-6 text-sm text-bad">
                The site isn&apos;t connected to Supabase yet. Add the Supabase settings and redeploy.
              </p>
            )}
          </div>
          <p className="enter mt-6 max-w-xs text-xs leading-5 text-mute" style={at(1150)}>
            By invitation only. Accounts are created by the OBC team.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}

/** Opening sequence: the OBC wordmark draws in on black, then the curtain lifts (pure CSS, see .intro). */
function Intro() {
  return (
    <div className="intro" aria-hidden>
      <div className="intro-inner">
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="intro-side">EST</span>
          <span className="intro-obc">OBC</span>
          <span className="intro-side">2026</span>
        </div>
        <span className="intro-line" />
        <span className="intro-tag">Partnership Program</span>
      </div>
    </div>
  );
}

function Login() {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));

  // Already logged in? Go straight to the courses.
  useEffect(() => {
    supabase()
      .auth.getSession()
      .then(({ data }) => data.session && router.replace(next));
  }, [next, router]);

  return <LoginForm next={next} />;
}
