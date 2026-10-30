"use client";

import { useState } from "react";
import { LeadBadge, LeadNotes } from "@/components/LeadNotes";
import {
  acceptApplication,
  applyUrl,
  CONTACT_OPTIONS,
  contactHref,
  isSetupMissing,
  leadStatus,
  linkParts,
  type Application,
  type LeadNote,
  type LeadOutcome,
} from "@/lib/applications";
import { archiveApplication, archiveError, restoreApplication } from "@/lib/archive";
import { eventStatus, formatDate, fromNow, prettyUrl } from "@/lib/format";
import { errorMessage } from "@/lib/hooks";
import type { NetEvent } from "@/lib/network";

/** Applications and their call notes, loaded by the Admin page and shared with Archives. */
export type ApplicationsState = {
  data?: [Application[], LeadNote[] | null] | null;
  error?: string;
  reload: () => void;
};

/** Call notes by application (empty lists until 0008_leads.sql has been run: notes are null then). */
export function notesByApplication(notes: LeadNote[] | null) {
  const map = new Map<string, LeadNote[]>();
  for (const n of notes ?? []) map.set(n.application_id, [...(map.get(n.application_id) ?? []), n]);
  return map;
}

const viaLabel = (a: Application) => CONTACT_OPTIONS.find((o) => o.value === a.contact_via)?.label ?? a.contact_via;

type Filter = "all" | "to_call" | LeadOutcome;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "to_call", label: "To call" },
  { value: "follow_up", label: "Follow-up" },
  { value: "closed", label: "Closed" },
];

/**
 * Admin page: applications from /apply/, worked as leads. Each has call notes (Closed or Follow-up needed);
 * Accept puts the person on the guest list; Archive moves a lead you won't accept to Archives (with Undo).
 */
export function ApplicationsAdmin({
  events,
  apps,
  onChanged,
}: {
  events: NetEvent[];
  apps: ApplicationsState;
  /** The guest list changed (someone was accepted). */
  onChanged: () => void;
}) {
  const { data, error, reload } = apps;
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string; undo?: Application } | null>(null);
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

  async function archive(a: Application) {
    setBusy(a.id);
    setNotice(null);
    try {
      await archiveApplication(a.id);
      setNotice({ ok: true, text: `${a.full_name} moved to Archives.`, undo: a });
      reload();
    } catch (e) {
      setNotice({ ok: false, text: `Couldn't archive: ${archiveError(errorMessage(e))}` });
    } finally {
      setBusy(null);
    }
  }

  async function undo(a: Application) {
    setNotice(null);
    try {
      await restoreApplication(a.id);
      setNotice({ ok: true, text: `${a.full_name} is back with the leads.` });
      reload();
    } catch (e) {
      setNotice({ ok: false, text: `Couldn't bring it back: ${archiveError(errorMessage(e))}` });
    }
  }

  const [all, notes] = data ?? [null, null];
  // Archived leads are in Archives, at the bottom of the Admin page.
  const applications = all?.filter((a) => a.status !== "archived") ?? null;
  // null: call notes aren't set up yet (0008_leads.sql not run).
  const notesByApp = notesByApplication(notes);
  const statusOf = (a: Application) => leadStatus(notesByApp.get(a.id));
  const counts = Object.fromEntries(
    FILTERS.map((f) => [f.value, applications?.filter((a) => f.value === "all" || statusOf(a).outcome === f.value).length ?? 0]),
  ) as Record<Filter, number>;
  const shown = (applications ?? [])
    .filter((a) => filter === "all" || statusOf(a).outcome === filter)
    // Follow-ups: the soonest date first, those without a date last.
    .sort((a, b) =>
      filter === "follow_up" ? (statusOf(a).followUpOn ?? "9999").localeCompare(statusOf(b).followUpOn ?? "9999") : 0,
    );
  const newCount = applications?.filter((a) => a.status === "new").length ?? 0;
  const waiting = shown.filter((a) => a.status === "new");
  const accepted = shown.filter((a) => a.status === "accepted");
  const card = (a: Application) => (
    <ApplicationCard
      key={a.id}
      a={a}
      event={a.event_id ? eventsById.get(a.event_id) : undefined}
      notes={notes ? (notesByApp.get(a.id) ?? []) : null}
      onNotesChanged={reload}
      actions={
        a.status === "new" && (
          <>
            <button onClick={() => accept(a)} disabled={busy === a.id} className="btn-primary px-5 py-2 text-xs">
              {busy === a.id ? "Working…" : a.event_id && eventsById.has(a.event_id) ? "Accept · add to guest list" : "Accept · add as guest"}
            </button>
            <button onClick={() => archive(a)} disabled={busy === a.id} className="btn-ghost px-4 py-2 text-xs">
              Archive
            </button>
          </>
        )
      }
    />
  );

  return (
    <section className="mt-14">
      <div data-reveal className="mb-6 flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="display text-3xl">
          Applications
          {newCount > 0 && (
            <span className="ml-3 align-middle font-sans text-sm tracking-normal text-mute">{newCount} new</span>
          )}
        </h2>
        <button onClick={copyLink} className="btn-ghost px-4 py-2.5 text-xs">
          {copied ? "Copied" : "Copy application link"}
        </button>
      </div>

      {notice && (
        <p role="status" className={`enter card mb-4 px-5 py-4 text-sm ${notice.ok ? "text-good" : "text-bad"}`}>
          {notice.text}
          {notice.undo && (
            <button
              type="button"
              onClick={() => undo(notice.undo!)}
              className="ml-3 text-bone underline decoration-bone/40 underline-offset-4 transition hover:decoration-bone"
            >
              Undo
            </button>
          )}
        </p>
      )}

      {applications && notes && applications.length > 0 && (
        <div role="group" aria-label="Show leads" className="mb-5 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full border px-3.5 py-1.5 text-xs transition duration-300 ease-smooth ${filter === f.value ? "border-bone/70 bg-elevated text-bone" : "border-line text-mute hover:border-bone/30 hover:text-bone"}`}
            >
              {f.label} <span className="tabular-nums text-mute">{counts[f.value]}</span>
            </button>
          ))}
        </div>
      )}
      {applications && notes === null && (
        <p className="card mb-4 px-5 py-4 text-sm leading-6 text-mute">
          Call notes aren&apos;t set up in Supabase yet: run{" "}
          <code className="text-bone">supabase/migrations/0008_leads.sql</code> in its SQL Editor, then reload this page.
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
      ) : !applications ? (
        <div className="card grid place-items-center p-10">
          <span className="spinner" role="status" aria-label="Loading" />
        </div>
      ) : waiting.length === 0 ? (
        <p className="card p-6 text-sm leading-6 text-mute">
          {filter === "all"
            ? "No new applications. Share the application link, or an event's own link from the Events table below."
            : "No applications waiting with this status."}
        </p>
      ) : (
        <ul className="grid gap-4">{waiting.map(card)}</ul>
      )}

      {accepted.length > 0 && (
        <details className="group mt-5">
          <summary className="cursor-pointer list-none text-sm text-mute transition hover:text-bone [&::-webkit-details-marker]:hidden">
            <span className="inline-block transition group-open:rotate-90">›</span> Accepted ({accepted.length})
          </summary>
          <ul className="mt-3 grid gap-4">{accepted.map(card)}</ul>
        </details>
      )}
    </section>
  );
}

/** One application with its details and call notes; `actions` are the buttons top right. */
export function ApplicationCard({
  a,
  event,
  notes,
  actions,
  onNotesChanged,
}: {
  a: Application;
  event?: NetEvent;
  /** null when call notes aren't set up yet. */
  notes: LeadNote[] | null;
  actions?: React.ReactNode;
  onNotesChanged: () => void;
}) {
  const over = event && eventStatus(event) === "past";
  const work = [a.role, a.company, a.city].filter(Boolean).join(" · ");
  return (
    <li className="card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2.5 text-base font-medium">
            {a.full_name}
            {notes && <LeadBadge notes={notes} />}
            {a.status === "accepted" && (
              <span className="text-[10px] uppercase tracking-widest text-good">On the guest list</span>
            )}
          </p>
          <p className="mt-1 text-xs text-mute">
            {event ? (
              <>
                For {event.title} · {formatDate(event.starts_at, { day: "numeric", month: "short" })}
              </>
            ) : (
              "Any event"
            )}{" "}
            · applied {fromNow(a.created_at)}
            {a.status === "archived" && a.archived_at && <> · archived {fromNow(a.archived_at)}</>}
            {over && a.status !== "archived" && <span className="text-accent"> · this event is over</span>}
          </p>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
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
      {notes && <LeadNotes applicationId={a.id} name={a.full_name} notes={notes} onChanged={onNotesChanged} />}
    </li>
  );
}
