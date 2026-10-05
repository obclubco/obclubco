"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApplicationsAdmin } from "@/components/ApplicationsAdmin";
import { useMe } from "@/components/GuestGate";
import { EyeOff } from "@/components/Icons";
import { SearchInput } from "@/components/SearchInput";
import { SplitWords } from "@/components/SplitWords";
import { ErrorState, Loading } from "@/components/States";
import { eventStatus, formatDate } from "@/lib/format";
import { applyUrl, getOpenEventIds, setApplicationsOpen } from "@/lib/applications";
import { errorMessage, useLoad, usePageTitle } from "@/lib/hooks";
import { getAdminOverview, getMyEvents, type NetEvent } from "@/lib/network";

const fmt = (iso: string | null) => (iso ? formatDate(iso, { day: "numeric", month: "short", year: "numeric" }) : "—");

export default function ManagePage() {
  const me = useMe();
  const router = useRouter();
  usePageTitle("Admin");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  // Events taking applications, as switched on this page (until the next reload).
  const [openIds, setOpenIds] = useState<Set<string> | null>(null);
  const [copiedEvent, setCopiedEvent] = useState<string | null>(null);
  const [eventsNote, setEventsNote] = useState<string | null>(null);
  useEffect(() => {
    if (!me.is_admin) router.replace("/home/");
  }, [me.is_admin, router]);
  const { data, error, reload } = useLoad(
    () => (me.is_admin ? Promise.all([getMyEvents(), getAdminOverview(), getOpenEventIds()]) : Promise.resolve(null)),
    [me.is_admin],
  );

  if (!me.is_admin) return <Loading />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;
  const [events, guests, loadedOpenIds] = data;
  // Null until 0006_applications.sql has been run in Supabase: no switches then.
  const open = openIds ?? loadedOpenIds ?? new Set<string>();

  async function toggleApplications(e: NetEvent) {
    const next = new Set(open);
    if (next.has(e.id)) next.delete(e.id);
    else next.add(e.id);
    setOpenIds(next);
    setEventsNote(null);
    try {
      await setApplicationsOpen(e.id, next.has(e.id));
    } catch (err) {
      setOpenIds(open);
      setEventsNote(`Couldn't change applications for ${e.title}: ${errorMessage(err)}`);
    }
  }

  async function copyEventLink(id: string) {
    try {
      await navigator.clipboard.writeText(applyUrl(id));
      setCopiedEvent(id);
      setTimeout(() => setCopiedEvent(null), 2500);
    } catch {
      window.prompt("Copy the application link:", applyUrl(id));
    }
  }

  const withoutLogin = guests.filter((g) => !g.has_login);
  const q = query.trim().toLowerCase();
  const shown = guests.filter((g) => !q || [g.full_name, g.email, g.company, g.role].some((v) => v?.toLowerCase().includes(q)));

  async function copyEmails() {
    try {
      await navigator.clipboard.writeText(withoutLogin.map((g) => g.email).join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy these emails:", withoutLogin.map((g) => g.email).join(", "));
    }
  }

  return (
    <div className="container-x py-12 sm:py-16">
      <p className="eyebrow enter">Admin</p>
      <h1 className="display mt-4 text-5xl">
        <SplitWords text="Guests & Events" delay={100} />
      </h1>
      <div className="enter mt-5 max-w-3xl space-y-2 text-sm leading-6 text-mute" style={{ "--d": "300ms" } as React.CSSProperties}>
        <p>
          <span className="text-bone">Events</span> are added in Supabase (Table Editor → <code className="text-bone">events</code>).{" "}
          <span className="text-bone">Guest lists</span>: open an event below and paste the emails of who was there; new
          people are added to the site at the same time.{" "}
          <span className="text-bone">Logins</span>: in Supabase (Table Editor → <code className="text-bone">guests</code>), type a
          password in <code className="text-bone">set_password</code> and send it to them.{" "}
          <span className="text-bone">Applications</span>: switch them on for an event below and share its link; accepting
          someone puts them on that event&apos;s guest list.
        </p>
      </div>

      <div
        data-reveal
        className="glow-card glow-inset mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4"
      >
        {[
          ["Guests", guests.length],
          ["With a login", guests.length - withoutLogin.length],
          ["Events", events.length],
          ["Coming up", events.filter((e) => eventStatus(e) !== "past").length],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface p-6">
            <p className="display text-4xl">{v}</p>
            <p className="mt-1 text-[11px] uppercase tracking-widest text-mute">{k}</p>
          </div>
        ))}
      </div>

      <ApplicationsAdmin events={events} onChanged={reload} />

      <section className="mt-14">
        <h2 data-reveal className="display mb-6 border-b border-line pb-4 text-3xl">
          Events
        </h2>
        {eventsNote && (
          <p role="alert" className="card mb-4 px-5 py-4 text-sm text-bad">
            {eventsNote}
          </p>
        )}
        <div data-reveal className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-line text-[11px] uppercase tracking-widest text-mute">
              <tr>
                <th className="px-5 py-4 font-medium">Event</th>
                <th className="px-5 py-4 font-medium">Date</th>
                <th className="px-5 py-4 font-medium">Guests</th>
                <th className="px-5 py-4 font-medium">Applications</th>
                <th className="px-5 py-4 font-medium">
                  <span className="sr-only">Guest list</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {events.map((e) => (
                <tr key={e.id} className="transition duration-300 hover:bg-elevated/60">
                  <td className="px-5 py-4">
                    <p>{e.title}</p>
                    {!e.is_published && <p className="text-xs text-accent">Draft · hidden from guests</p>}
                  </td>
                  <td className="px-5 py-4 text-mute">{fmt(e.starts_at)}</td>
                  <td className="px-5 py-4">{e.guest_count}</td>
                  <td className="px-5 py-4">
                    {eventStatus(e) === "past" || !loadedOpenIds ? (
                      <span className="text-mute">—</span>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={open.has(e.id)}
                          aria-label={`Take applications for ${e.title}`}
                          onClick={() => toggleApplications(e)}
                          className={`relative h-6 w-11 shrink-0 rounded-full border transition duration-300 ease-smooth ${open.has(e.id) ? "border-accent bg-accent" : "border-line bg-elevated"}`}
                        >
                          <span
                            className={`absolute top-[2px] size-[18px] rounded-full transition-all duration-300 ease-smooth ${open.has(e.id) ? "left-[22px] bg-ink" : "left-[2px] bg-bone/60"}`}
                          />
                        </button>
                        {open.has(e.id) ? (
                          <button
                            type="button"
                            onClick={() => copyEventLink(e.id)}
                            className="text-xs text-bone/80 underline decoration-bone/30 underline-offset-4 transition hover:text-bone hover:decoration-bone"
                          >
                            {copiedEvent === e.id ? "Copied" : "Copy link"}
                          </button>
                        ) : (
                          <span className="text-xs text-mute">Off</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link href={`/event/?id=${e.id}`} className="btn-ghost px-4 py-2 text-xs">
                      Guest list
                    </Link>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-mute">
                    No events yet. Add one in Supabase → Table Editor → events.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-14">
        <div data-reveal className="mb-6 flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="display text-3xl">Guests</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {withoutLogin.length > 0 && (
              <button onClick={copyEmails} className="btn-ghost px-4 py-2.5 text-xs">
                {copied ? "Copied" : `Copy ${withoutLogin.length} without a login`}
              </button>
            )}
            <SearchInput value={query} onChange={setQuery} placeholder="Search guests" className="sm:w-64" />
          </div>
        </div>
        <div data-reveal className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line text-[11px] uppercase tracking-widest text-mute">
              <tr>
                <th className="px-5 py-4 font-medium">Guest</th>
                <th className="px-5 py-4 font-medium">Company</th>
                <th className="px-5 py-4 font-medium">Events</th>
                <th className="px-5 py-4 font-medium">Last event</th>
                <th className="px-5 py-4 font-medium">Login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((g) => (
                <tr key={g.id} className="transition duration-300 hover:bg-elevated/60">
                  <td className="px-5 py-4">
                    <p className="flex items-center gap-2">
                      {g.id === me.id || g.events === 0 ? (
                        g.full_name
                      ) : (
                        <Link href={`/guest/?id=${g.id}`} className="underline-offset-4 hover:underline">
                          {g.full_name}
                        </Link>
                      )}
                      {g.is_admin && <span className="text-[10px] uppercase tracking-widest text-accent">Admin</span>}
                      {!g.is_visible && (
                        <span title="Hidden from other guests" className="text-mute">
                          <EyeOff className="size-3.5" />
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-mute">{g.email}</p>
                  </td>
                  <td className="px-5 py-4 text-bone/80">{g.company ?? "—"}</td>
                  <td className="px-5 py-4">{g.events}</td>
                  <td className="px-5 py-4 text-mute">{fmt(g.last_event_at)}</td>
                  <td className="px-5 py-4">
                    {g.last_sign_in_at ? (
                      <span className="text-good">Active · {fmt(g.last_sign_in_at)}</span>
                    ) : g.has_login ? (
                      <span className="text-bone/80">Not used yet</span>
                    ) : (
                      <span className="text-mute">No login yet</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
