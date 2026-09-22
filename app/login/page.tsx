"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Starfield } from "@/components/Starfield";
import { usePageTitle } from "@/lib/hooks";
import { isConfigured, supabase } from "@/lib/supabase";
import { LoginForm } from "./LoginForm";

function safeNext(next: string | null) {
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard/";
}

export default function LoginPage() {
  usePageTitle("Log in");
  return (
    <main className="grain relative flex min-h-dvh flex-col">
      <Starfield count={110} />
      <div className="container-x relative flex h-20 items-center">
        <Logo />
      </div>
      <div className="container-x relative flex flex-1 items-center justify-center pb-24">
        <div className="w-full max-w-md">
          <div className="flex justify-center">
            <span className="pill">
              <span className="size-1.5 rounded-full bg-bone" /> Partners only
            </span>
          </div>
          <h1 className="display mt-7 text-center text-5xl sm:text-6xl">Welcome Back.</h1>
          <p className="mt-4 text-center text-sm text-mute">
            Enter the email the OB Club team approved. We&apos;ll send you a secure sign-in link — no password needed.
          </p>
          {isConfigured ? (
            <Suspense>
              <Login />
            </Suspense>
          ) : (
            <p className="card mt-10 p-6 text-center text-sm text-bad">
              The site isn&apos;t connected to Supabase yet. Add the Supabase settings and redeploy.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function Login() {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));

  useEffect(() => {
    supabase()
      .auth.getSession()
      .then(({ data }) => data.session && router.replace(next));
  }, [next, router]);

  return <LoginForm next={next} initialError={params.get("error") ?? undefined} />;
}
