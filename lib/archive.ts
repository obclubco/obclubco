import { isSetupMissing } from "@/lib/applications";
import { clearCache } from "@/lib/network";
import { supabase } from "@/lib/supabase";

/** Archives (0009_archive.sql): leads you don't accept and profiles you remove, kept instead of deleted. */

export type ArchivedGuest = {
  id: string;
  email: string;
  full_name: string;
  role: string | null;
  company: string | null;
  events: number;
  archived_at: string;
};

async function call(fn: string, id: string) {
  const { error } = await supabase().rpc(fn, { p_id: id });
  clearCache();
  if (error) throw error;
}

/** Archived profiles, most recently archived first; null before 0009_archive.sql has been run. */
export async function getArchivedGuests(): Promise<ArchivedGuest[] | null> {
  const { data, error } = await supabase().rpc("admin_archived_guests");
  if (error && isSetupMissing(error.message)) return null;
  if (error) throw error;
  return (data ?? []) as ArchivedGuest[];
}

/** Takes someone off every guest list and stops their login, keeping everything for Restore. */
export const archiveGuest = (id: string) => call("archive_guest", id);
export const restoreGuest = (id: string) => call("restore_guest", id);
/** Only archived profiles: deletes the profile, its place on guest lists and the login. */
export const deleteArchivedGuest = (id: string) => call("delete_archived_guest", id);

/** A lead that's still waiting goes to Archives, with its call notes. */
export const archiveApplication = (id: string) => call("archive_application", id);
export const restoreApplication = (id: string) => call("restore_application", id);

/** Errors that mean 0009_archive.sql hasn't been run yet, in words for the Admin page. */
export function archiveError(message: string) {
  return isSetupMissing(message)
    ? "Archives need an update in Supabase: run supabase/migrations/0009_archive.sql in its SQL Editor, then try again."
    : message;
}
