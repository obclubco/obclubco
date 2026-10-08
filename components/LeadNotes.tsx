"use client";

import { useState } from "react";
import { Plus } from "@/components/Icons";
import {
  addLeadNote,
  deleteLeadNote,
  LEAD_NOTE_MAX,
  LEAD_OUTCOMES,
  leadStatus,
  updateLeadNote,
  type LeadNote,
  type LeadOutcome,
} from "@/lib/applications";
import { formatDate, fromNow } from "@/lib/format";
import { errorMessage } from "@/lib/hooks";

const day = (date: string) => formatDate(date, { weekday: "short", day: "numeric", month: "short" });
const today = () => new Date().toLocaleDateString("en-CA"); // "2026-10-07", local time

/** "To call", "Closed", "Follow-up · Thu 15 Oct": where a lead stands after the latest call. */
export function LeadBadge({ notes }: { notes: LeadNote[] | undefined }) {
  const { outcome, followUpOn } = leadStatus(notes);
  const overdue = outcome === "follow_up" && followUpOn !== null && followUpOn < today();
  const style = {
    to_call: "border-line text-mute",
    closed: "border-good/40 text-good",
    follow_up: overdue ? "border-bad/50 text-bad" : "border-bone/40 text-bone",
    no: "border-line text-mute line-through decoration-mute/60",
  }[outcome];
  const label = {
    to_call: "To call",
    closed: "Closed",
    follow_up: `Follow-up${followUpOn ? ` · ${day(followUpOn)}` : ""}${overdue ? " · overdue" : ""}`,
    no: "No",
  }[outcome];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-widest ${style}`}>
      {label}
    </span>
  );
}

const OUTCOME_TEXT: Record<LeadOutcome, string> = { closed: "✅ Closed", follow_up: "🔁 Follow-up needed", no: "❌ No" };

/** Call notes on an application: the history (each note editable) and a form to write down a new call. */
export function LeadNotes({
  applicationId,
  name,
  notes,
  onChanged,
}: {
  applicationId: string;
  name: string;
  notes: LeadNote[];
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function remove(note: LeadNote) {
    if (!window.confirm(`Delete this call note about ${name}?`)) return;
    setMessage(null);
    try {
      await deleteLeadNote(note.id);
      onChanged();
    } catch (err) {
      setMessage({ ok: false, text: `Couldn't delete: ${errorMessage(err)}` });
    }
  }

  return (
    <div className="mt-5 border-t border-line pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-widest text-mute">
          Calls{notes.length > 0 && <span className="text-bone/70"> · {notes.length}</span>}
        </p>
        {!adding && (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setEditing(null);
              setMessage(null);
            }}
            className="btn-ghost gap-1.5 px-4 py-2 text-xs"
          >
            <Plus className="size-3.5" /> Add call notes
          </button>
        )}
      </div>

      {message && (
        <p role="status" className={`mt-3 text-xs ${message.ok ? "text-good" : "text-bad"}`}>
          {message.text}
        </p>
      )}

      {adding && (
        <NoteForm
          id={`new-${applicationId}`}
          submitLabel="Save"
          onCancel={() => setAdding(false)}
          onSave={async (outcome, body, followUpOn) => {
            await addLeadNote(applicationId, outcome, body, followUpOn);
            setAdding(false);
            setMessage({ ok: true, text: "Saved." });
            onChanged();
          }}
        />
      )}

      {notes.length > 0 && (
        <ol className="mt-4 grid gap-3">
          {notes.map((n) =>
            editing === n.id ? (
              <li key={n.id}>
                <NoteForm
                  id={n.id}
                  note={n}
                  submitLabel="Save changes"
                  onCancel={() => setEditing(null)}
                  onSave={async (outcome, body, followUpOn) => {
                    await updateLeadNote(n.id, outcome, body, followUpOn);
                    setEditing(null);
                    setMessage({ ok: true, text: "Changes saved." });
                    onChanged();
                  }}
                />
              </li>
            ) : (
              <li key={n.id} className="rounded-2xl border border-line px-4 py-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
                  <span className="text-bone">
                    {OUTCOME_TEXT[n.outcome]}
                    {n.follow_up_on && <span className="text-bone/80"> · {day(n.follow_up_on)}</span>}
                  </span>
                  <span className="text-mute">
                    {n.author_name ?? "Admin"} · {fromNow(n.created_at)}
                    {n.updated_at && " · edited"}
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(n.id);
                        setAdding(false);
                        setMessage(null);
                      }}
                      className="ml-3 transition hover:text-bone"
                    >
                      Edit
                    </button>
                    <button type="button" onClick={() => remove(n)} className="ml-3 transition hover:text-bad">
                      Delete
                    </button>
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-bone/90">{n.body}</p>
              </li>
            ),
          )}
        </ol>
      )}
    </div>
  );
}

/** Writing or editing a call note: what you talked about, how it went, and when to follow up. */
function NoteForm({
  id,
  note,
  submitLabel,
  onSave,
  onCancel,
}: {
  id: string;
  note?: LeadNote;
  submitLabel: string;
  onSave: (outcome: LeadOutcome, body: string, followUpOn: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [body, setBody] = useState(note?.body ?? "");
  // An older "No" note has to be given one of today's outcomes when it's edited.
  const [outcome, setOutcome] = useState<LeadOutcome | null>(note && note.outcome !== "no" ? note.outcome : null);
  const [followUpOn, setFollowUpOn] = useState(note?.follow_up_on ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return setProblem("Write what you talked about.");
    if (!outcome) return setProblem("Pick how it went: Closed or Follow-up needed.");
    setBusy(true);
    setProblem(null);
    try {
      await onSave(outcome, body.trim(), followUpOn || null);
    } catch (err) {
      setProblem(`Couldn't save: ${errorMessage(err)}`);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="enter mt-4 grid gap-4 rounded-2xl border border-line bg-elevated/30 p-4 sm:p-5">
      <div>
        <label htmlFor={`note-${id}`} className="block text-sm font-medium">
          What did you talk about?
        </label>
        <textarea
          id={`note-${id}`}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setProblem(null);
          }}
          maxLength={LEAD_NOTE_MAX}
          rows={4}
          placeholder="What they're after, questions they had, what you agreed…"
          className="textarea mt-2.5"
          autoFocus
        />
      </div>
      <fieldset>
        <legend className="text-sm font-medium">How did it go?</legend>
        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
          {LEAD_OUTCOMES.map((o) => (
            <label key={o.value} className="block">
              <input
                type="radio"
                name={`outcome-${id}`}
                value={o.value}
                checked={outcome === o.value}
                onChange={() => {
                  setOutcome(o.value);
                  setProblem(null);
                }}
                className="peer sr-only"
              />
              <span className="flex h-11 cursor-pointer items-center justify-center rounded-full border border-line bg-elevated/40 px-3 text-sm text-bone/75 transition duration-300 ease-smooth hover:border-bone/30 peer-checked:border-bone/70 peer-checked:bg-elevated peer-checked:text-bone peer-focus-visible:ring-2 peer-focus-visible:ring-bone/70">
                {o.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {outcome === "follow_up" && (
        <div>
          <label htmlFor={`follow-${id}`} className="block text-sm font-medium">
            Follow up on <span className="font-normal text-mute">(optional)</span>
          </label>
          <input
            id={`follow-${id}`}
            type="date"
            value={followUpOn}
            onChange={(e) => setFollowUpOn(e.target.value)}
            className="input mt-2.5 sm:w-56"
          />
        </div>
      )}
      {problem && (
        <p role="alert" className="text-xs text-bad">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary px-5 py-2.5 text-xs" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-mute transition hover:text-bone">
          Cancel
        </button>
      </div>
    </form>
  );
}
