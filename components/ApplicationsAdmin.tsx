"use client";

import { useState } from "react";
import {
  acceptApplication,
  applyUrl,
  CONTACT_OPTIONS,
  contactHref,
  deleteApplication,
  getApplications,
  isSetupMissing,
  linkParts,
  type Application,
} from "@/lib/applications";
import { eventStatus, formatDate, fromNow, prettyUrl } from "@/lib/format";
import { errorMessage, useLoad } from "@/lib/hooks";
import type { NetEvent } from "@/lib/network";

const viaLabel = (a: Application) => CONTACT_OPTIONS.find((o) => o.value === a.contact_via)?.label ?? a.contact_via;

/** Admin page: applications from /apply/. Accept puts the person on the guest list; Delete declines. */
export function ApplicationsAdmin({ events, onChanged }: { events: NetEvent[]; onChanged: () => void }) {
  const { data, error, reload } = useLoad(getApplications, []);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const eventsById = new Map(events.map((e) => [e.id, e]));

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(applyUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy the application link:", applyUrl());
    }
  }

  async function accept(a: Application) {
    setBusy(a.id);
    setNotice(null);
    try {
      await acceptApplication(a.id);
      const event = a.event_id ? eventsById.get(a.event_id) : undefined;
      setNotice({
        ok: true,
        text: `${a.full_name} is on the guest list${event ? ` for ${event.title}` : ""}. To give them a login, type a password in their set_password cell (Supabase → Table Editor → guests), then send it to them.`,
      });
      reload();
      onChanged();
    } catch (e) {
      setNotice({ ok: false, text: `Couldn't accept: ${errorMessage(e)}` });
    } finally {
      setBusy(null);
    }
  }

  async function remove(a: Application) {
    if (!window.confirm(`Delete ${a.full_name}'s application? This can't be undone.`)) return;
    setBusy(a.id);
    setNotice(null);
    try {
      await deleteApplication(a.id);
      reload();
    } catch (e) {
      setNotice({ ok: false, text: `Couldn't delete: ${errorMessage(e)}` });
    } finally {
      setBusy(null);
    }
  }

  const waiting = data?.filter((a) => a.status === "new") ?? [];
  const accepted = data?.filter((a) => a.status === "accepted") ?? [];

  return (
    <section className="mt-14">
      <div data-reveal className="mb-6 flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="display text-3xl">
          Applications
          {waiting.length > 0 && (
            <span className="ml-3 align-middle font-sans text-sm tracking-normal text-mute">{waiting.length} new</span>
          )}
        </h2>
        <button onClick={copyLink} className="btn-ghost px-4 py-2.5 text-xs">
          {copied ? "Copied" : "Copy application link"}
        </button>
      </div>

      {notice && (
        <p role="status" className={`enter card mb-4 px-5 py-4 text-sm ${notice.ok ? "text-good" : "text-bad"}`}>
          {notice.text}
        </p>
      )}

      {error && isSetupMissing(error) ? (
        <p className="card p-6 text-sm leading-6 text-mute">
          Applications aren&apos;t set up in Supabase yet: run{" "}
          <code className="text-bone">supabase/migrations/0006_applications.sql</code> in its SQL Editor, then reload this
          page.
        </p>
      ) : error ? (
        <p className="card p-6 text-sm text-bad">Couldn&apos;t load applications: {error}</p>
      ) : !data ? (
        <div className="card grid place-items-center p-10">
          <span className="spinner" role="status" aria-label="Loading" />
        </div>
      ) : waiting.length === 0 ? (
        <p className="card p-6 text-sm leading-6 text-mute">
          No new applications. Share the application link, or an event&apos;s own link from the Events table below.
        </p>
      ) : (
        <ul className="grid gap-4">
          {waiting.map((a) => (
            <ApplicationCard
              key={a.id}
              a={a}
              event={a.event_id ? eventsById.get(a.event_id) : undefined}
              busy={busy === a.id}
              onAccept={() => accept(a)}
              onDelete={() => remove(a)}
            />
          ))}
        </ul>
      )}

      {accepted.length > 0 && (
        <details className="group mt-5">
          <summary className="cursor-pointer list-none text-sm text-mute transition hover:text-bone [&::-webkit-details-marker]:hidden">
            <span className="inline-block transition group-open:rotate-90">›</span> Accepted ({accepted.length})
          </summary>
          <ul className="card mt-3 divide-y divide-line">
            {accepted.map((a) => {
              const event = a.event_id ? eventsById.get(a.event_id) : undefined;
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm">
                  <span className="min-w-0">
                    {a.full_name} <span className="text-mute">· {event ? event.title : "Any event"}</span>
                    {a.reviewed_at && <span className="text-mute"> · accepted {fromNow(a.reviewed_at)}</span>}
                  </span>
                  <button onClick={() => remove(a)} disabled={busy === a.id} className="text-xs text-mute transition hover:text-bad">
                    Delete application
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </section>
  );
}

function ApplicationCard({
  a,
  event,
  busy,
  onAccept,
  onDelete,
}: {
  a: Application;
  event?: NetEvent;
  busy: boolean;
  onAccept: () => void;
  onDelete: () => void;
}) {
  const over = event && eventStatus(event) === "past";
  const work = [a.role, a.company, a.city].filter(Boolean).join(" · ");
  return (
    <li className="card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-base font-medium">{a.full_name}</p>
          <p className="mt-1 text-xs text-mute">
            {event ? (
              <>
                For {event.title} · {formatDate(event.starts_at, { day: "numeric", month: "short" })}
              </>
            ) : (
              "Any event"
            )}{" "}
            · applied {fromNow(a.created_at)}
            {over && <span className="text-accent"> · this event is over</span>}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={onAccept} disabled={busy} className="btn-primary px-5 py-2 text-xs">
            {busy ? "Working…" : event ? "Accept · add to guest list" : "Accept · add as guest"}
          </button>
          <button onClick={onDelete} disabled={busy} className="btn-ghost px-4 py-2 text-xs">
            Delete
          </button>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-4 sm:gap-y-2.5">
        <dt className="text-xs uppercase tracking-widest text-mute sm:pt-0.5">Contact</dt>
        <dd className="min-w-0 break-words">
          <a href={contactHref(a.phone, a.contact_via)} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
            {a.phone}
          </a>{" "}
          <span className="text-mute">· prefers {viaLabel(a)} ·</span>{" "}
          <a href={`mailto:${a.email}`} className="underline-offset-4 hover:underline">
            {a.email}
          </a>
        </dd>
        {work && (
          <>
            <dt className="text-xs uppercase tracking-widest text-mute sm:pt-0.5">Work</dt>
            <dd className="min-w-0 break-words text-bone/90">{work}</dd>
          </>
        )}
        {a.note && (
          <>
            <dt className="text-xs uppercase tracking-widest text-mute sm:pt-0.5">Why</dt>
            <dd className="min-w-0 whitespace-pre-line break-words text-bone/90">{a.note}</dd>
          </>
        )}
        {a.referred_by && (
          <>
            <dt className="text-xs uppercase tracking-widest text-mute sm:pt-0.5">Heard via</dt>
            <dd className="min-w-0 break-words text-bone/90">{a.referred_by}</dd>
          </>
        )}
        {a.links && (
          <>
            <dt className="text-xs uppercase tracking-widest text-mute sm:pt-0.5">Links</dt>
            <dd className="min-w-0 whitespace-pre-line break-words text-bone/90">
              {linkParts(a.links).map((p, i) =>
                p.url ? (
                  <a
                    key={i}
                    href={p.url}
                    target="_blank"
                    rel="noreferrer nofollow"
                    className="underline decoration-bone/30 underline-offset-4 hover:decoration-bone"
                  >
                    {prettyUrl(p.url)}
                  </a>
                ) : (
                  <span key={i}>{p.text}</span>
                ),
              )}
            </dd>
          </>
        )}
      </dl>
    </li>
  );
}
