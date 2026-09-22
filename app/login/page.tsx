import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(safeNext);

  return (
    <main className="grain flex min-h-dvh flex-col">
      <div className="container-x flex h-20 items-center">
        <Logo />
      </div>
      <div className="container-x flex flex-1 items-center justify-center pb-24">
        <div className="w-full max-w-md">
          <p className="eyebrow text-center">Partners only</p>
          <h1 className="display mt-4 text-center text-5xl sm:text-6xl">Welcome back.</h1>
          <p className="mt-4 text-center text-sm text-mute">
            Enter the email the OB Club team approved. We&apos;ll send you a secure sign-in link — no password needed.
          </p>
          <LoginForm next={safeNext} initialError={error} />
        </div>
      </div>
    </main>
  );
}
