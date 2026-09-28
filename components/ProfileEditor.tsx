"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { GuestProfile } from "@/components/GuestProfile";
import { Camera } from "@/components/Icons";
import { instagramUrl, linkedinUrl, websiteUrl } from "@/lib/format";
import { errorMessage } from "@/lib/hooks";
import { deletePhoto, updateProfile, uploadPhoto, type Me, type ProfileFields, type PublicProfile } from "@/lib/network";

type TextKey =
  | "full_name"
  | "role"
  | "company"
  | "city"
  | "bio"
  | "interests"
  | "looking_for"
  | "can_help_with"
  | "linkedin"
  | "instagram"
  | "website"
  | "phone";
type Draft = Record<TextKey, string> & { share_contact: boolean; is_visible: boolean };
type Errors = Partial<Record<TextKey, string>>;

/** Same limits as the database. */
const MAX: Record<TextKey, number> = {
  full_name: 120,
  role: 120,
  company: 120,
  city: 80,
  bio: 1000,
  interests: 600,
  looking_for: 500,
  can_help_with: 500,
  linkedin: 300,
  instagram: 300,
  website: 300,
  phone: 40,
};
const MAX_INTERESTS = 12;

/** A saved Instagram profile link shows in the form as the @handle people typed. */
function instagramInput(url: string | null) {
  const handle = url?.match(/^https:\/\/www\.instagram\.com\/([\w.]+)\/$/)?.[1];
  return handle ? `@${handle}` : (url ?? "");
}

function toDraft(me: Me): Draft {
  return {
    full_name: me.full_name,
    role: me.role ?? "",
    company: me.company ?? "",
    city: me.city ?? "",
    bio: me.bio ?? "",
    interests: me.interests.join(", "),
    looking_for: me.looking_for ?? "",
    can_help_with: me.can_help_with ?? "",
    linkedin: me.linkedin ?? "",
    instagram: instagramInput(me.instagram),
    website: me.website ?? "",
    phone: me.phone ?? "",
    share_contact: me.share_contact,
    is_visible: me.is_visible,
  };
}

const text = (v: string) => v.trim() || null;

/** "Real estate, AI,  ai , " → ["Real estate", "AI"] */
function parseInterests(v: string) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of v.split(",")) {
    const t = raw.trim().slice(0, 40);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out.slice(0, MAX_INTERESTS);
}

/** The form as it will be saved (links turned into full URLs), plus anything that needs fixing first. */
function toFields(d: Draft): { fields: Omit<ProfileFields, "photo_url">; errors: Errors } {
  const errors: Errors = {};
  const link = (key: "linkedin" | "instagram" | "website", toUrl: (v: string) => string | null, what: string) => {
    if (!d[key].trim()) return null;
    const url = toUrl(d[key]);
    if (!url) errors[key] = `That doesn't look like ${what}.`;
    return url;
  };
  if (!d.full_name.trim()) errors.full_name = "Your name is needed.";
  const fields = {
    full_name: d.full_name.trim(),
    role: text(d.role),
    company: text(d.company),
    city: text(d.city),
    bio: text(d.bio),
    interests: parseInterests(d.interests),
    looking_for: text(d.looking_for),
    can_help_with: text(d.can_help_with),
    linkedin: link("linkedin", linkedinUrl, "a LinkedIn profile"),
    instagram: link("instagram", instagramUrl, "an Instagram handle"),
    website: link("website", websiteUrl, "a web address"),
    phone: text(d.phone),
    share_contact: d.share_contact,
    is_visible: d.is_visible,
  };
  return { fields, errors };
}

/** The Profile page: the form on one side, a live preview of what other guests see on the other. */
export function ProfileEditor({ me, onSaved }: { me: Me; onSaved: (me: Me) => void }) {
  const [draft, setDraft] = useState(() => toDraft(me));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const { fields } = toFields(draft);
  const dirty = JSON.stringify(fields) !== JSON.stringify(toFields(toDraft(me)).fields);
  const preview: PublicProfile = {
    ...fields,
    full_name: fields.full_name || me.full_name,
    photo_url: me.photo_url,
    email: fields.share_contact ? me.email : null,
    phone: fields.share_contact ? fields.phone : null,
  };

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setStatus(null);
  };

  const input = (key: TextKey, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input
      id={key}
      value={draft[key]}
      onChange={(e) => set(key, e.target.value)}
      maxLength={MAX[key]}
      aria-invalid={!!errors[key]}
      className={`input ${errors[key] ? "border-bad/70" : ""}`}
      {...props}
    />
  );
  const area = (key: TextKey, placeholder: string) => (
    <textarea
      id={key}
      value={draft[key]}
      onChange={(e) => set(key, e.target.value)}
      maxLength={MAX[key]}
      placeholder={placeholder}
      rows={key === "bio" ? 5 : 3}
      className="textarea"
    />
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const result = toFields(draft);
    setErrors(result.errors);
    if (Object.keys(result.errors).length) {
      setStatus({ ok: false, text: "Check the highlighted fields." });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const updated = await updateProfile(me.id, result.fields);
      onSaved(updated);
      setDraft(toDraft(updated));
      setStatus({ ok: true, text: "Saved" });
    } catch (err) {
      setStatus({ ok: false, text: `Couldn't save: ${errorMessage(err)}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <form onSubmit={save} noValidate className="min-w-0">
        <div className="card divide-y divide-line bg-surface/80 backdrop-blur">
          <Section title="Photo">
            <PhotoField me={me} onSaved={onSaved} />
          </Section>

          <Section title="The basics">
            <Field id="full_name" label="Name" error={errors.full_name}>
              {input("full_name", { required: true, autoComplete: "name" })}
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="role" label="Role">
                {input("role", { placeholder: "Founder & CEO", autoComplete: "organization-title" })}
              </Field>
              <Field id="company" label="Company">
                {input("company", { placeholder: "Northwind Studio", autoComplete: "organization" })}
              </Field>
            </div>
            <Field id="city" label="City">
              {input("city", { placeholder: "Amsterdam", autoComplete: "address-level2" })}
            </Field>
          </Section>

          <Section title="About you">
            <Field id="bio" label="Short bio" count={`${draft.bio.length}/${MAX.bio}`}>
              {area("bio", "What you do, what you've built, what you care about.")}
            </Field>
            <Field id="looking_for" label="Looking for" hint="Clients, investors, a co-founder, a new hire…">
              {area("looking_for", "Who would you like to meet?")}
            </Field>
            <Field id="can_help_with" label="Can help with" hint="What people can come to you for.">
              {area("can_help_with", "Intros, advice, skills you're happy to share.")}
            </Field>
            <Field
              id="interests"
              label="Interests"
              hint={`Separate with commas, up to ${MAX_INTERESTS}.`}
              count={`${fields.interests.length}/${MAX_INTERESTS}`}
            >
              {input("interests", { placeholder: "Real estate, AI, Hospitality" })}
            </Field>
          </Section>

          <Section title="Links">
            <Field id="linkedin" label="LinkedIn" error={errors.linkedin}>
              {input("linkedin", { placeholder: "linkedin.com/in/yourname", inputMode: "url", autoCapitalize: "none" })}
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="instagram" label="Instagram" error={errors.instagram}>
                {input("instagram", { placeholder: "@yourhandle", autoCapitalize: "none" })}
              </Field>
              <Field id="website" label="Website" error={errors.website}>
                {input("website", { placeholder: "yourcompany.com", inputMode: "url", autoCapitalize: "none" })}
              </Field>
            </div>
          </Section>

          <Section title="Contact & privacy">
            <Field id="phone" label="Phone or WhatsApp">
              {input("phone", { type: "tel", placeholder: "+31 6 1234 5678", autoComplete: "tel" })}
            </Field>
            <div className="divide-y divide-line">
              <Switch
                checked={draft.share_contact}
                onChange={(v) => set("share_contact", v)}
                label="Share my email and phone"
                hint={`Guests you've met can see ${me.email}${draft.phone.trim() ? " and your phone number" : ""}.`}
              />
              <Switch
                checked={draft.is_visible}
                onChange={(v) => set("is_visible", v)}
                label="Show my profile to other guests"
                hint="Turn off to leave yourself out of guest lists. You can still see everyone else."
              />
            </div>
          </Section>
        </div>

        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 mt-6 md:bottom-4">
          <div className="flex items-center justify-between gap-3 rounded-full border border-line bg-ink/85 p-1.5 pl-5 shadow-[0_20px_50px_-15px_rgb(0_0_0/0.9)] backdrop-blur-md">
            <p
              role={status && !status.ok ? "alert" : "status"}
              className={`truncate text-xs ${status ? (status.ok ? "text-good" : "text-bad") : "text-mute"}`}
            >
              {status?.text ?? (dirty ? "Unsaved changes" : "All changes saved")}
            </p>
            <button className="btn-primary shrink-0 px-5 py-2.5 text-[13px]" disabled={saving || !dirty}>
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </div>
      </form>

      <aside className="order-first min-w-0 lg:order-none lg:sticky lg:top-28 lg:self-start">
        <p className="eyebrow mb-4">What other guests see</p>
        <div className="card glow-card grain bg-surface/80 p-6 backdrop-blur sm:p-8">
          <GuestProfile profile={preview} as="h2" />
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-5 p-6 sm:p-7">
      <legend className="sr-only">{title}</legend>
      <p aria-hidden className="eyebrow">
        {title}
      </p>
      {children}
    </fieldset>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  count,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  count?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="block text-xs text-bone/80">
          {label}
        </label>
        {count && <span className="text-[10px] tabular-nums text-mute">{count}</span>}
      </div>
      <div className="mt-2">{children}</div>
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-bad">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-mute">{hint}</p>
      )}
    </div>
  );
}

function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-5 py-4 first:pt-1 last:pb-0">
      <span>
        <span className="block text-sm">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-mute">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition duration-300 ease-smooth ${checked ? "border-accent bg-accent" : "border-line bg-elevated"}`}
      >
        <span
          className={`absolute top-[2px] size-[18px] rounded-full transition-all duration-300 ease-smooth ${checked ? "left-[22px] bg-ink" : "left-[2px] bg-bone/60"}`}
        />
      </button>
    </label>
  );
}

// ── Photo ──

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Scales a photo down to at most 800px (as a JPEG) so it uploads fast and loads fast. */
async function shrink(file: File, max = 800): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("NOT_AN_IMAGE");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Formats the browser can't draw (e.g. HEIC outside Safari): upload as is when allowed.
    if (PHOTO_TYPES.includes(file.type) && file.size <= 5 * 1024 * 1024) return file;
    throw new Error("UNREADABLE");
  }
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("UNREADABLE"))), "image/jpeg", 0.85),
  );
}

function photoError(e: unknown) {
  const message = errorMessage(e);
  if (message === "NOT_AN_IMAGE") return "Choose a photo (JPG or PNG).";
  if (message === "UNREADABLE" || /mime|type/i.test(message)) return "That photo couldn't be read. Try a JPG or PNG.";
  if (/size|large/i.test(message)) return "That photo is too big. Try a smaller one.";
  return "Couldn't upload the photo. Please try again.";
}

/** Uploading or removing a photo saves straight away. */
function PhotoField({ me, onSaved }: { me: Me; onSaved: (me: Me) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy("upload");
    setError(null);
    try {
      const url = await uploadPhoto(me.id, await shrink(file));
      const updated = await updateProfile(me.id, { photo_url: url });
      onSaved(updated);
      await deletePhoto(me.id, me.photo_url).catch(() => {});
    } catch (e) {
      setError(photoError(e));
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function remove() {
    setBusy("remove");
    setError(null);
    try {
      const updated = await updateProfile(me.id, { photo_url: null });
      onSaved(updated);
      await deletePhoto(me.id, me.photo_url).catch(() => {});
    } catch (e) {
      setError(`Couldn't remove the photo: ${errorMessage(e)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-5">
      <Avatar name={me.full_name} url={me.photo_url} size="lg" />
      <div className="min-w-0">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={!!busy}
            className="btn-ghost gap-2 px-4 py-2 text-xs"
          >
            <Camera /> {busy === "upload" ? "Uploading…" : me.photo_url ? "Change photo" : "Add a photo"}
          </button>
          {me.photo_url && (
            <button type="button" onClick={remove} disabled={!!busy} className="btn-ghost px-4 py-2 text-xs">
              {busy === "remove" ? "Removing…" : "Remove"}
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-mute">A clear photo of your face helps people recognise you.</p>
        {error && (
          <p role="alert" className="mt-2 text-xs text-bad">
            {error}
          </p>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </div>
    </div>
  );
}
