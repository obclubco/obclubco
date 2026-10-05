"use client";

import { useRef, useState } from "react";
import { Arrow, Check, Plus } from "@/components/Icons";
import {
  APPLICATION_MAX,
  CONTACT_OPTIONS,
  CONTACT_PHRASE,
  submitApplication,
  type ContactVia,
  type OpenEvent,
} from "@/lib/applications";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/hooks";

type TextKey = "full_name" | "email" | "phone" | "company" | "role" | "city" | "note" | "referred_by";
type Draft = Record<TextKey, string> & { event_id: string | null; contact_via: ContactVia; consent: boolean; trap: string };
type Errors = Partial<Record<"full_name" | "email" | "phone" | "role" | "note" | "consent", string>>;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function validate(d: Draft): Errors {
  const errors: Errors = {};
  const digits = d.phone.replace(/\D/g, "").length;
  if (!d.full_name.trim()) errors.full_name = "Please add your name.";
  if (!d.email.trim()) errors.email = "Please add your email.";
  else if (!EMAIL.test(d.email.trim())) errors.email = "That doesn't look like an email address.";
  if (!d.phone.trim()) errors.phone = "Please add your phone number.";
  else if (!/^[+\d\s().-]+$/.test(d.phone.trim()) || digits < 6 || digits > 15)
    errors.phone = "That doesn't look like a phone number. Include the country code, like +371.";
  if (!d.role.trim()) errors.role = "Please tell us what you do.";
  if (!d.note.trim()) errors.note = "Please tell us why you'd like to come.";
  if (!d.consent) errors.consent = "Please tick this so we can review your application.";
  return errors;
}

function friendly(message: string) {
  if (/EVENT_CLOSED/.test(message)) return "Applications for this event have just closed.";
  if (/TRY_LATER/.test(message)) return "Lots of applications are coming in right now. Please try again in a few minutes.";
  if (/CONSENT_REQUIRED/.test(message)) return "Please tick the box above so we can review your application.";
  if (/ANSWERS_REQUIRED/.test(message)) return "Please answer every question marked *.";
  if (/fetch|network|load failed/i.test(message)) return "Couldn't reach the server. Check your connection and try again.";
  if (/check constraint|violates/i.test(message)) return "Something in the form isn't quite right. Please check your answers.";
  return "Something went wrong. Please try again.";
}

const text = (v: string) => v.trim() || null;

/**
 * The application form: five required questions (name, email, phone, what they do, why they'd like to come), how
 * to get in touch, optional * extras and consent. With several events open, it starts by asking which one.
 */
export function ApplyForm({ choices }: { choices: OpenEvent[] }) {
  const [draft, setDraft] = useState<Draft>({
    event_id: choices[0]?.id ?? null,
    full_name: "",
    email: "",
    phone: "",
    contact_via: "whatsapp",
    company: "",
    role: "",
    city: "",
    note: "",
    referred_by: "",
    consent: false,
    trap: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [sent, setSent] = useState<{ name: string; via: ContactVia; phone: string; event?: OpenEvent } | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setProblem(null);
  };

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const found = validate(draft);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      e.currentTarget.querySelector<HTMLElement>(`#${first}`)?.focus();
      return;
    }
    setSending(true);
    setProblem(null);
    try {
      await submitApplication({
        event_id: draft.event_id,
        full_name: draft.full_name.trim(),
        email: draft.email.trim().toLowerCase(),
        phone: draft.phone.trim(),
        contact_via: draft.contact_via,
        links: null,
        company: text(draft.company),
        role: text(draft.role),
        city: text(draft.city),
        note: text(draft.note),
        referred_by: text(draft.referred_by),
        consent: draft.consent,
        trap: draft.trap,
      });
      setSent({
        name: draft.full_name.trim().split(/\s+/)[0],
        via: draft.contact_via,
        phone: draft.phone.trim(),
        event: choices.find((c) => c.id === draft.event_id),
      });
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      setProblem(friendly(errorMessage(err)));
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div ref={top} className="scroll-mt-28">
        <div role="status" className="enter card glow-card bg-surface/80 p-8 text-center backdrop-blur-md sm:p-10">
          <span className="mx-auto grid size-14 place-items-center rounded-full border border-line bg-elevated text-bone">
            <Check className="size-6" />
          </span>
          <h2 className="display mt-6 text-4xl">Thank you, {sent.name}.</h2>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-bone/75">
            Your application{sent.event && <> for <span className="text-bone">{sent.event.title}</span></>} is in. We&apos;ll
            get back to you {CONTACT_PHRASE[sent.via]} at <span className="whitespace-nowrap text-bone">{sent.phone}</span>.
          </p>
          <p className="mt-6 text-xs leading-5 text-mute">Only the people reviewing applications see your details.</p>
        </div>
      </div>
    );
  }

  const field = (key: TextKey, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input
      id={key}
      value={draft[key]}
      onChange={(e) => set(key, e.target.value)}
      maxLength={APPLICATION_MAX[key]}
      aria-invalid={!!errors[key as keyof Errors]}
      aria-describedby={errors[key as keyof Errors] ? `${key}-error` : undefined}
      className={`input ${errors[key as keyof Errors] ? "border-bad/70" : ""}`}
      {...props}
    />
  );

  return (
    <div ref={top} className="scroll-mt-28">
      <form onSubmit={send} noValidate className="card glow-card bg-surface/80 p-6 backdrop-blur-md sm:p-8">
        <h2 className="text-xl font-semibold">Apply</h2>
        <p className="mt-1.5 text-sm text-mute">Only five questions are required.</p>

        {choices.length > 1 && (
          <fieldset className="mt-7">
            <legend className="text-sm font-medium">Which event?</legend>
            <div className="mt-3 grid gap-2.5">
              {choices.map((c) => (
                <label key={c.id} className="block">
                  <input
                    type="radio"
                    name="event"
                    value={c.id}
                    checked={draft.event_id === c.id}
                    onChange={() => set("event_id", c.id)}
                    className="peer sr-only"
                  />
                  <span className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-line bg-elevated/40 px-5 py-3.5 text-sm text-bone/80 transition duration-300 ease-smooth hover:border-bone/30 peer-checked:border-bone/70 peer-checked:bg-elevated peer-checked:text-bone peer-focus-visible:ring-2 peer-focus-visible:ring-bone/70">
                    <span className="min-w-0 truncate">{c.title}</span>
                    <span className="shrink-0 text-xs text-mute">
                      {formatDate(c.starts_at, { weekday: "short", day: "numeric", month: "short" })}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="mt-7 grid gap-6">
          <Question id="full_name" label="Full name" required error={errors.full_name}>
            {field("full_name", { autoComplete: "name" })}
          </Question>

          <Question id="email" label="Email" required error={errors.email}>
            {field("email", {
              type: "email",
              inputMode: "email",
              autoComplete: "email",
              autoCapitalize: "none",
              placeholder: "you@company.com",
            })}
          </Question>

          <Question id="phone" label="Phone" required error={errors.phone}>
            {field("phone", { type: "tel", inputMode: "tel", autoComplete: "tel", placeholder: "+371" })}
          </Question>

          <fieldset>
            <legend className="text-sm font-medium">How should we contact you?</legend>
            <div className="mt-2.5 grid grid-cols-3 gap-2.5">
              {CONTACT_OPTIONS.map((o) => (
                <label key={o.value} className="block">
                  <input
                    type="radio"
                    name="contact_via"
                    value={o.value}
                    checked={draft.contact_via === o.value}
                    onChange={() => set("contact_via", o.value)}
                    className="peer sr-only"
                  />
                  <span className="flex h-12 cursor-pointer items-center justify-center rounded-full border border-line bg-elevated/40 px-2 text-sm text-bone/75 transition duration-300 ease-smooth hover:border-bone/30 peer-checked:border-bone/70 peer-checked:bg-elevated peer-checked:text-bone peer-focus-visible:ring-2 peer-focus-visible:ring-bone/70">
                    {o.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <Question id="role" label="What do you do?" required error={errors.role}>
            {field("role", { autoComplete: "organization-title", placeholder: "Founder, investor, chef…" })}
          </Question>

          <Question id="note" label="Why would you like to come?" required error={errors.note}>
            <textarea
              id="note"
              value={draft.note}
              onChange={(e) => set("note", e.target.value)}
              maxLength={APPLICATION_MAX.note}
              rows={3}
              placeholder="What you're working on, who you'd like to meet."
              aria-invalid={!!errors.note}
              aria-describedby={errors.note ? "note-error" : undefined}
              className={`textarea ${errors.note ? "border-bad/70" : ""}`}
            />
          </Question>

          <details className="group rounded-2xl border border-line bg-elevated/30">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-2xl px-5 py-4 text-sm transition hover:bg-elevated/50 [&::-webkit-details-marker]:hidden">
              <Plus className="size-4 text-mute transition duration-300 ease-smooth group-open:rotate-45" />
              <span className="font-medium">Tell us more</span>
              <span className="text-xs text-mute">(optional)</span>
            </summary>
            <div className="grid gap-5 border-t border-line p-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Question id="company" label="Company">
                  {field("company", { autoComplete: "organization" })}
                </Question>
                <Question id="city" label="City">
                  {field("city", { autoComplete: "address-level2" })}
                </Question>
              </div>
              <Question id="referred_by" label="Who told you about OB Club?">
                {field("referred_by")}
              </Question>
            </div>
          </details>

          <div>
            <label className="flex cursor-pointer items-start gap-3.5">
              <input
                id="consent"
                type="checkbox"
                checked={draft.consent}
                onChange={(e) => set("consent", e.target.checked)}
                aria-invalid={!!errors.consent}
                aria-describedby={errors.consent ? "consent-error" : undefined}
                className="mt-0.5 size-5 shrink-0 cursor-pointer accent-bone"
              />
              <span className="text-sm leading-6 text-bone/80">
                I agree that OB Club uses these details only to review my application, as described{" "}
                <a href="#privacy" className="underline decoration-bone/30 underline-offset-4 hover:decoration-bone">
                  at the bottom of this page
                </a>
                , and deletes them if I&apos;m not invited.
              </span>
            </label>
            {errors.consent && (
              <p id="consent-error" role="alert" className="mt-2 pl-8 text-xs text-bad">
                {errors.consent}
              </p>
            )}
          </div>
        </div>

        {/* Hidden from people (and screen readers); bots that fill in every field give themselves away here. */}
        <div aria-hidden className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden">
          <label htmlFor="obc-extra">Leave this empty</label>
          <input
            id="obc-extra"
            tabIndex={-1}
            autoComplete="off"
            value={draft.trap}
            onChange={(e) => set("trap", e.target.value)}
          />
        </div>

        <button className="btn-primary mt-8 w-full py-3.5" disabled={sending}>
          {sending ? "Sending…" : "Send application"} {!sending && <Arrow />}
        </button>
        {problem && (
          <p role="alert" className="enter mt-4 text-center text-sm text-bad">
            {problem}
          </p>
        )}
        <p className="mt-5 text-center text-xs leading-5 text-mute">
          Only the people reviewing applications see your details. No newsletters, no obligations.
        </p>
      </form>
    </div>
  );
}

function Question({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required && (
          <span aria-hidden className="text-mute">
            {" "}
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      <div className="mt-2.5">{children}</div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-bad">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-2 text-xs leading-5 text-mute">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
