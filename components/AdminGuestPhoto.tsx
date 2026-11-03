"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Camera } from "@/components/Icons";
import { isSetupMissing } from "@/lib/applications";
import { errorMessage } from "@/lib/hooks";
import { setGuestPhoto } from "@/lib/network";
import { photoProblem, shrinkPhoto } from "@/lib/photos";

type Guest = { id: string; full_name: string; photo_url: string | null };

/** Why an admin couldn't change a guest's photo, in words. */
export function guestPhotoError(e: unknown) {
  const message = errorMessage(e);
  if (isSetupMissing(message) || /row-level security|unauthorized/i.test(message)) {
    return "Changing guests' photos isn't set up in Supabase yet: run supabase/migrations/0011_admin_photos.sql in its SQL Editor, then try again.";
  }
  if (message.includes("GUEST_NOT_FOUND")) return "This guest isn't on the site any more. Reload the page.";
  if (message.includes("NOT_AUTHORIZED")) return "Only admins can change other guests' photos.";
  if (message.includes("PHOTO_NOT_FOUND")) return "The photo didn't upload. Please try again.";
  return photoProblem(message) ?? `Something went wrong (${message}). Please try again.`;
}

/** Picking a new photo (or none) for a guest; saves straight away. */
function useGuestPhoto(guest: Guest, onChanged: (url: string | null) => void, onError: (text: string | null) => void) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);

  async function run(kind: "upload" | "remove", work: () => Promise<string | null>) {
    setBusy(kind);
    onError(null);
    try {
      onChanged(await work());
    } catch (e) {
      onError(guestPhotoError(e));
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) run("upload", async () => setGuestPhoto(guest.id, await shrinkPhoto(file)));
      }}
    />
  );

  return {
    busy,
    fileInput,
    pick: () => input.current?.click(),
    remove: () => {
      if (window.confirm(`Remove ${guest.full_name}'s photo? It's deleted for good.`)) run("remove", () => setGuestPhoto(guest.id, null));
    },
  };
}

/** On a guest's profile page, for admins: Change photo and Remove photo. */
export function GuestPhotoActions({ guest, onChanged }: { guest: Guest; onChanged: (url: string | null) => void }) {
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const { busy, fileInput, pick, remove } = useGuestPhoto(
    guest,
    (url) => {
      setNote({ ok: true, text: url ? "Photo changed." : "Photo removed." });
      onChanged(url);
    },
    (text) => setNote(text ? { ok: false, text } : null),
  );

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={pick} disabled={!!busy} className="btn-ghost gap-2 px-4 py-2 text-xs">
          <Camera /> {busy === "upload" ? "Uploading…" : guest.photo_url ? "Change photo" : "Add a photo"}
        </button>
        {guest.photo_url && (
          <button type="button" onClick={remove} disabled={!!busy} className="btn-ghost px-4 py-2 text-xs">
            {busy === "remove" ? "Removing…" : "Remove photo"}
          </button>
        )}
      </div>
      {note ? (
        <p role={note.ok ? "status" : "alert"} className={`mt-2 text-xs ${note.ok ? "text-good" : "text-bad"}`}>
          {note.text}
        </p>
      ) : (
        <p className="mt-2 text-xs text-mute">Only admins see these buttons.</p>
      )}
      {fileInput}
    </div>
  );
}

/** In the Admin page's Guests table: the guest's photo; tap it to pick a new one. */
export function GuestPhotoButton({
  guest,
  onChanged,
  onError,
}: {
  guest: Guest;
  onChanged: (url: string | null) => void;
  onError: (text: string | null) => void;
}) {
  const { busy, fileInput, pick } = useGuestPhoto(guest, onChanged, onError);
  const label = guest.photo_url ? "Change photo" : "Add a photo";
  return (
    <>
      <button
        type="button"
        onClick={pick}
        disabled={!!busy}
        aria-label={`${label}: ${guest.full_name}`}
        title={label}
        className="group relative shrink-0 rounded-full"
      >
        <Avatar name={guest.full_name} url={guest.photo_url} size="sm" className="transition group-hover:opacity-80" />
        <span className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full border border-line bg-ink text-bone/70 transition group-hover:text-bone">
          <Camera className="size-3" />
        </span>
        {busy && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-ink/70">
            <span className="spinner size-5" role="status" aria-label="Uploading" />
          </span>
        )}
      </button>
      {fileInput}
    </>
  );
}
