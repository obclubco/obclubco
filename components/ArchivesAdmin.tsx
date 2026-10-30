"use client";

import { useState } from "react";
import { ApplicationCard, notesByApplication, type ApplicationsState } from "@/components/ApplicationsAdmin";
import { deleteApplication, type Application } from "@/lib/applications";
import { archiveError, deleteArchivedGuest, restoreApplication, restoreGuest, type ArchivedGuest } from "@/lib/archive";
import { formatDate, fromNow } from "@/lib/format";
import { errorMessage } from "@/lib/hooks";
import type { NetEvent } from "@/lib/network";

const summaryClass =
  "cursor-pointer list-none text-sm text-mute transition hover:text-bone [&::-webkit-details-marker]:hidden";

/**
 * Admin page, at the bottom: leads you didn't accept and profiles you removed, kept instead of deleted.
 * Restore puts them back as they were; Delete for good is the only way anything is deleted from the site.
 */
export function ArchivesAdmin({
  events,
  apps,
  guests,
  onGuestsChanged,
}: {
  events: NetEvent[];
  apps: ApplicationsState;
  /** Archived profiles; null before 0009_archive.sql has been run. */
  guests: ArchivedGuest[] | null;
  onGuestsChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const eventsById = new Map(events.map((e) => [e.id, e]));
  const [all, notes] = apps.data ?? [null, null];
  const leads = (all ?? [])
    .filter((a) => a.status === "archived")
    .sort((a, b) => (b.archived_at ?? "").localeCompare(a.archived_at ?? ""));
  const notesByApp = notesByApplication(notes);

  async function act(id: string, run: () => Promise<void>, done: string, failed: string) {
    setBusy(id);
    setNotice(null);
    try {
      await run();
      setNotice({ ok: true, text: done });
    } catch (e) {
      setNotice({ ok: false, text: `${failed}: ${archiveError(errorMessage(e))}` });
    } finally {
      setBusy(null);
    }
  }

  const restoreLead = (a: Application) =>
    act(
      a.id,
      async () => {
        await restoreApplication(a.id);
        apps.reload();
      },
      `${a.full_name} is back with the leads.`,
      "Couldn't restore",
    );

  function deleteLead(a: Application) {
    if (!window.confirm(`Delete ${a.full_name}'s application for good? Its details and call notes can't be brought back.`)) return;
    act(
      a.id,
      async () => {
        await deleteApplication(a.id);
        apps.reload();
      },
      `${a.full_name}'s application is deleted.`,
      "Couldn't delete",
    );
  }

  const restoreProfile = (g: ArchivedGuest) =>
    act(
      g.id,
      async () => {
        await restoreGuest(g.id);
        onGuestsChanged();
      },
      `${g.full_name} is back on their guest lists and can log in again.`,
      "Couldn't restore",
    );

  function deleteProfile(g: ArchivedGuest) {
    if (
      !window.confirm(
        `Delete ${g.full_name} for good? Their profile, their place on guest lists and their login are deleted. This can't be undone.`,
      )
    )
      return;
    act(
      g.id,
      async () => {
        await deleteArchivedGuest(g.id);
        onGuestsChanged();
      },
      `${g.full_name} is deleted.`,
      "Couldn't delete",
    );
  }

  return (
    <section className="mt-14">
      <div data-reveal className="mb-6 border-b border-line pb-4">
        <h2 className="display text-3xl">Archives</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-mute">
          Leads you didn&apos;t accept and profiles you removed. Nothing here shows on the site, and archived people
          can&apos;t log in. Restore puts them back as they were.
        </p>
      </div>

      {notice && (
        <p role="status" className={`enter card mb-4 px-5 py-4 text-sm ${notice.ok ? "text-good" : "text-bad"}`}>
          {notice.text}
        </p>
      )}

      {guests === null ? (
        <p className="card p-6 text-sm leading-6 text-mute">
          Archives aren&apos;t set up in Supabase yet: run{" "}
          <code className="text-bone">supabase/migrations/0009_archive.sql</code> in its SQL Editor, then reload this page.
        </p>
      ) : (
        <div className="grid gap-6">
          <details className="group">
            <summary className={summaryClass}>
              <span className="inline-block transition group-open:rotate-90">›</span> Leads ({leads.length})
            </summary>
            {leads.length === 0 ? (
              <p className="card mt-3 p-6 text-sm leading-6 text-mute">
                No archived leads. Archive a lead you won&apos;t accept and it moves here.
              </p>
            ) : (
              <ul className="mt-3 grid gap-4">
                {leads.map((a) => (
                  <ApplicationCard
                    key={a.id}
                    a={a}
                    event={a.event_id ? eventsById.get(a.event_id) : undefined}
                    notes={notes ? (notesByApp.get(a.id) ?? []) : null}
                    onNotesChanged={apps.reload}
                    actions={
                      <>
                        <button onClick={() => restoreLead(a)} disabled={busy === a.id} className="btn-primary px-5 py-2 text-xs">
                          Restore
                        </button>
                        <button onClick={() => deleteLead(a)} disabled={busy === a.id} className="btn-ghost px-4 py-2 text-xs">
                          Delete for good
                        </button>
                      </>
                    }
                  />
                ))}
              </ul>
            )}
          </details>

          <details className="group">
            <summary className={summaryClass}>
              <span className="inline-block transition group-open:rotate-90">›</span> Profiles ({guests.length})
            </summary>
            {guests.length === 0 ? (
              <p className="card mt-3 p-6 text-sm leading-6 text-mute">
                No archived profiles. Archive someone in the Guests table above and they move here.
              </p>
            ) : (
              <div className="card mt-3 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-line text-[11px] uppercase tracking-widest text-mute">
                    <tr>
                      <th className="px-5 py-4 font-medium">Guest</th>
                      <th className="px-5 py-4 font-medium">Company</th>
                      <th className="px-5 py-4 font-medium">Events</th>
                      <th className="px-5 py-4 font-medium">Archived</th>
                      <th className="px-5 py-4 font-medium">
                        <span className="sr-only">Restore or delete</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {guests.map((g) => (
                      <tr key={g.id} className="transition duration-300 hover:bg-elevated/60">
                        <td className="px-5 py-4">
                          <p>{g.full_name}</p>
                          <p className="text-xs text-mute">{g.email}</p>
                        </td>
                        <td className="px-5 py-4 text-bone/80">{g.company ?? "—"}</td>
                        <td className="px-5 py-4">{g.events}</td>
                        <td className="px-5 py-4 text-mute" title={formatDate(g.archived_at, { day: "numeric", month: "short", year: "numeric" })}>
                          {fromNow(g.archived_at)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => restoreProfile(g)} disabled={busy === g.id} className="btn-primary px-4 py-2 text-xs">
                              Restore
                            </button>
                            <button onClick={() => deleteProfile(g)} disabled={busy === g.id} className="btn-ghost px-4 py-2 text-xs">
                              Delete for good
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </details>
        </div>
      )}
    </section>
  );
}
