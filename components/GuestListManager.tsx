"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { EyeOff, Shield } from "@/components/Icons";
import { errorMessage } from "@/lib/hooks";
import { addEventGuests, parseGuestLines, removeEventGuest, type Guest, type NetEvent } from "@/lib/network";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Admins only: add people to an event's guest list by pasting emails, or take them off it. */
export function GuestListManager({ event, guests, onChange }: { event: NetEvent; guests: Guest[]; onChange: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; lines: string[] } | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { rows, skipped } = parseGuestLines(text);
    if (!rows.length) return setMessage({ ok: false, lines: ["Paste at least one email address."] });
    setBusy(true);
    setMessage(null);
    try {
      const result = await addEventGuests(event.id, rows);
      const lines = [
        result.added
          ? `Added ${plural(result.added, "guest")} to the list${result.created ? ` (${result.created} new to the site: create their logins in Supabase)` : ""}.`
          : "Everyone you pasted is already on the list.",
      ];
      if (result.missing.length)
        lines.push(
          `${plural(result.missing.length, "email")} ${result.missing.length === 1 ? "isn't" : "aren't"} on the guest list yet. Add a name to ${result.missing.length === 1 ? "it" : "each"} (e.g. "Jane Doe, jane@company.com") and add again.`,
        );
      if (skipped) lines.push(`Skipped ${plural(skipped, "line")} without an email address.`);
      setMessage({ ok: !result.missing.length, lines });
      // Keep only the people that still need a name, so they can be fixed and added again.
      setText(rows.filter((r) => result.missing.includes(r.email)).map((r) => r.email).join("\n"));
      onChange();
    } catch (err) {
      setMessage({ ok: false, lines: [`Couldn't add guests: ${errorMessage(err)}`] });
    } finally {
      setBusy(false);
    }
  }

  async function remove(guest: Guest) {
    if (!window.confirm(`Take ${guest.full_name} off the guest list of ${event.title}?`)) return;
    setRemoving(guest.id);
    try {
      await removeEventGuest(event.id, guest.id);
      onChange();
    } catch (err) {
      setMessage({ ok: false, lines: [`Couldn't remove ${guest.full_name}: ${errorMessage(err)}`] });
    } finally {
      setRemoving(null);
    }
  }

  return (
    <section data-reveal className="card mt-16 border-dashed bg-surface/80 p-6 backdrop-blur sm:p-8">
      <p className="eyebrow flex items-center gap-2">
        <Shield className="size-4" /> Admin
      </p>
      <h2 className="display mt-3 text-3xl">Manage the Guest List</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-mute">
        Paste email addresses, one per line (a column copied from a spreadsheet works too). Someone who isn&apos;t on the
        guest list yet also needs a name: <span className="text-bone/85">Jane Doe, jane@company.com, Company</span>.
      </p>

      <form onSubmit={add} className="mt-6">
        <label htmlFor="guest-lines" className="sr-only">
          Guests to add
        </label>
        <textarea
          id="guest-lines"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder={"ava@example.com\nJane Doe, jane@company.com, Acme"}
          className="textarea font-mono text-xs"
        />
        <div className="mt-4 flex flex-wrap items-start gap-x-5 gap-y-3">
          <button className="btn-primary" disabled={busy || !text.trim()}>
            {busy ? "Adding…" : "Add to guest list"}
          </button>
          {message && (
            <div role={message.ok ? "status" : "alert"} className="enter max-w-xl space-y-1 pt-2 text-sm">
              {message.lines.map((line) => (
                <p key={line} className={message.ok ? "text-good" : "text-bone/85"}>
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      </form>

      <div className="mt-10">
        <p className="eyebrow">On the list · {guests.length + (event.attending ? 1 : 0)}</p>
        {guests.length === 0 ? (
          <p className="mt-3 text-sm text-mute">Nobody else yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {guests.map((g) => (
              <li key={g.id} className="flex items-center gap-3 px-4 py-3 transition duration-300 hover:bg-elevated/60">
                <Avatar name={g.full_name} url={g.photo_url} size="xs" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm">
                    {g.full_name}
                    {!g.is_visible && (
                      <span title="Hidden from other guests" className="text-mute">
                        <EyeOff className="size-3.5" />
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-mute">{g.email}</p>
                </div>
                <button
                  onClick={() => remove(g)}
                  disabled={removing === g.id}
                  className="btn-ghost shrink-0 px-3.5 py-1.5 text-xs"
                >
                  {removing === g.id ? "Removing…" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        )}
        {event.attending && <p className="mt-3 text-xs text-mute">You&apos;re on this list too.</p>}
      </div>
    </section>
  );
}
