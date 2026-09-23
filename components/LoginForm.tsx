"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Arrow } from "@/components/Icons";

function friendly(message: string) {
  if (/invalid login credentials/i.test(message)) return "Wrong email or password.";
  if (/email not confirmed/i.test(message)) return "Your account isn't activated yet. Contact the OBC team.";
  if (/rate limit|too many|security purposes/i.test(message)) return "Too many attempts. Please wait a minute and try again.";
  if (/fetch|network/i.test(message)) return "Couldn't reach the server. Check your connection and try again.";
  return message;
}

/** Email + password log in. Accounts are created by the OBC team in Supabase. */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      setBusy(false);
      return setError(friendly(error.message));
    }
    router.replace(next);
  }

  return (
    <form onSubmit={logIn} className="card glow-card mx-auto w-full max-w-sm bg-surface/70 p-6 text-left backdrop-blur-md sm:p-7">
      <label htmlFor="email" className="block text-xs text-mute">
        Email
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="input mt-2"
      />

      <label htmlFor="password" className="mt-5 block text-xs text-mute">
        Password
      </label>
      <div className="relative mt-2">
        <input
          id="password"
          type={show ? "text" : "password"}
          required
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input pr-16"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-widest text-mute transition hover:text-bone"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>

      <button className="btn-primary mt-6 w-full" disabled={busy}>
        {busy ? "Logging in…" : "Log in"} {!busy && <Arrow />}
      </button>
      {error && (
        <p role="alert" className="enter mt-4 text-center text-sm text-bad">
          {error}
        </p>
      )}
    </form>
  );
}
