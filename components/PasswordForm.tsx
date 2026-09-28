"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

function friendly(message: string) {
  if (/different from the old/i.test(message)) return "That's your current password. Choose a new one.";
  if (/reauthenticat|recent/i.test(message)) return "For security, log out and back in, then change your password.";
  if (/weak|at least|characters/i.test(message)) return message;
  if (/fetch|network/i.test(message)) return "Couldn't reach the server. Check your connection and try again.";
  return message;
}

/** Lets a guest replace the password the OBC team gave them. */
export function PasswordForm({ email }: { email: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function change(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setMessage({ ok: false, text: "Use at least 8 characters." });
    if (password !== confirm) return setMessage({ ok: false, text: "The two passwords don't match." });
    setBusy(true);
    setMessage(null);
    const { error } = await supabase().auth.updateUser({ password });
    setBusy(false);
    if (error) return setMessage({ ok: false, text: friendly(error.message) });
    setPassword("");
    setConfirm("");
    setMessage({ ok: true, text: "Password changed. Use the new one next time you log in." });
  }

  return (
    <form onSubmit={change} noValidate className="grid gap-4 sm:grid-cols-2">
      {/* Lets password managers save the new password under the right account. */}
      <input type="email" autoComplete="username" value={email} readOnly hidden />
      <div>
        <label htmlFor="new-password" className="block text-xs text-mute">
          New password
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input mt-2"
        />
      </div>
      <div>
        <label htmlFor="confirm-password" className="block text-xs text-mute">
          Type it again
        </label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="input mt-2"
        />
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button className="btn-ghost" disabled={busy || !password}>
          {busy ? "Saving…" : "Change password"}
        </button>
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`enter text-sm ${message.ok ? "text-good" : "text-bad"}`}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
