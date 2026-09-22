"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { siteOrigin, supabase } from "@/lib/supabase";
import { Arrow } from "@/components/Icons";

const ERRORS: Record<string, string> = {
  not_authorized: "This email isn't on the partner list yet. Contact the OB Club team to get access.",
  link_invalid: "That sign-in link is invalid or has expired. Request a new one below.",
};

function friendly(message: string) {
  if (/EMAIL_NOT_AUTHORIZED|Database error saving new user|Signups not allowed/i.test(message)) {
    return ERRORS.not_authorized;
  }
  if (/rate limit|security purposes/i.test(message)) return "Too many attempts. Please wait a minute and try again.";
  if (/expired|invalid/i.test(message)) return "That code is invalid or has expired.";
  return message;
}

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "sent">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ? (ERRORS[initialError] ?? initialError) : null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${siteOrigin()}/auth/callback/?next=${encodeURIComponent(next)}` },
    });
    setBusy(false);
    if (error) return setError(friendly(error.message));
    setStep("sent");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
    if (error) {
      setBusy(false);
      return setError(friendly(error.message));
    }
    router.replace(next);
  }

  if (step === "sent") {
    return (
      <div className="card mt-10 p-6 sm:p-8">
        <p className="text-center text-sm">
          Check <span className="text-gold">{email}</span> — we sent you a sign-in link.
        </p>
        <form onSubmit={verifyCode} className="mt-6 space-y-3">
          <label htmlFor="code" className="block text-center text-xs text-mute">
            Or enter the code from the email
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="input text-center font-mono tracking-[0.5em]"
          />
          <button className="btn-primary w-full" disabled={busy || code.length < 6}>
            {busy ? "Verifying…" : "Sign in"}
          </button>
        </form>
        {error && <p className="mt-4 text-center text-sm text-bad">{error}</p>}
        <button
          onClick={() => {
            setStep("email");
            setCode("");
            setError(null);
          }}
          className="mt-6 w-full text-center text-xs text-mute hover:text-bone"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={sendLink} className="mt-10 space-y-3">
      <label htmlFor="email" className="sr-only">
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
        className="input"
      />
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? "Sending…" : "Send sign-in link"} {!busy && <Arrow />}
      </button>
      {error && <p className="pt-2 text-center text-sm text-bad">{error}</p>}
    </form>
  );
}
