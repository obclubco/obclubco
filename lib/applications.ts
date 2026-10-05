import { safeUrl, telHref } from "@/lib/format";
import { clearCache } from "@/lib/network";
import { supabase } from "@/lib/supabase";

/** Applications from the public page /apply/ (no login), and the admin side of reviewing them. */

export type ContactVia = "whatsapp" | "call" | "telegram";

export const CONTACT_OPTIONS: { value: ContactVia; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "call", label: "Call" },
  { value: "telegram", label: "Telegram" },
];

/** "We'll get back to you on WhatsApp" */
export const CONTACT_PHRASE: Record<ContactVia, string> = {
  whatsapp: "on WhatsApp",
  call: "with a call",
  telegram: "on Telegram",
};

/** An event taking applications, as the public page shows it (no location, no guest list). */
export type OpenEvent = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  cover_image_url: string | null;
};

export type ApplicationInput = {
  event_id: string | null;
  full_name: string;
  email: string;
  phone: string;
  contact_via: ContactVia;
  links: string;
  company: string | null;
  role: string | null;
  city: string | null;
  note: string | null;
  referred_by: string | null;
  consent: boolean;
  /** A field hidden from people; anything in it marks the sender as a bot. */
  trap: string;
};

export type Application = Omit<ApplicationInput, "consent" | "trap"> & {
  id: string;
  status: "new" | "accepted";
  guest_id: string | null;
  created_at: string;
  reviewed_at: string | null;
};

/** Same limits as the database. */
export const APPLICATION_MAX = {
  full_name: 120,
  email: 254,
  phone: 40,
  links: 1000,
  company: 120,
  role: 120,
  city: 80,
  note: 1000,
  referred_by: 120,
} as const;

export async function getOpenEvents(): Promise<OpenEvent[]> {
  const { data, error } = await supabase().rpc("get_open_events");
  if (error) throw error;
  return (data ?? []) as OpenEvent[];
}

export async function submitApplication(input: ApplicationInput) {
  const { error } = await supabase().rpc("submit_application", { p: input });
  if (error) throw error;
}

// ── Admins ──

export async function getApplications(): Promise<Application[]> {
  const { data, error } = await supabase().from("applications").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Application[];
}

/** Puts the person on the guest list (and the event's list). Returns their guest id. */
export async function acceptApplication(id: string): Promise<string> {
  const { data, error } = await supabase().rpc("accept_application", { p_id: id });
  clearCache();
  if (error) throw error;
  return data as string;
}

export async function deleteApplication(id: string) {
  const { error } = await supabase().from("applications").delete().eq("id", id);
  if (error) throw error;
}

/** Ids of the events currently taking applications, or null before 0006_applications.sql has been run. */
export async function getOpenEventIds(): Promise<Set<string> | null> {
  const { data, error } = await supabase().from("events").select("id").eq("applications_open", true);
  if (error && isSetupMissing(error.message)) return null;
  if (error) throw error;
  return new Set((data ?? []).map((e: { id: string }) => e.id));
}

/** Errors meaning the database doesn't have the applications part yet (0006_applications.sql not run). */
export function isSetupMissing(message: string) {
  return /could not find the (table|function)|does not exist/i.test(message);
}

export async function setApplicationsOpen(eventId: string, open: boolean) {
  const { error } = await supabase().rpc("set_applications_open", { p_event_id: eventId, p_open: open });
  if (error) throw error;
}

// ── Helpers ──

/** The link to share: the application page, for one event or in general. */
export function applyUrl(eventId?: string) {
  const origin = typeof window === "undefined" ? (process.env.NEXT_PUBLIC_SITE_URL ?? "") : window.location.origin;
  return `${origin}/apply/${eventId ? `?event=${eventId}` : ""}`;
}

/** Opens a chat or call with the applicant the way they asked to be contacted. */
export function contactHref(phone: string, via: ContactVia) {
  const digits = phone.replace(/\D/g, "");
  if (via === "whatsapp") return `https://wa.me/${digits}`;
  if (via === "telegram") return `https://t.me/+${digits}`;
  return telHref(phone);
}

const LINKISH = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i;

/** Text in pieces with its web addresses marked: "see lina.lv, thanks" → "see ", "lina.lv" (a link), ", thanks". */
export function linkParts(text: string): { text: string; url: string | null }[] {
  const parts: { text: string; url: string | null }[] = [];
  for (const piece of text.split(/(\s+)/)) {
    const [, head = "", core = piece, tail = ""] = piece.match(/^([(<"'\[]*)(.*?)([.,;:!?)>"'\]]*)$/s) ?? [];
    const url = core && LINKISH.test(core) ? safeUrl(/^https?:\/\//i.test(core) ? core : `https://${core}`) : null;
    if (!url) parts.push({ text: piece, url: null });
    else parts.push({ text: head, url: null }, { text: core, url }, { text: tail, url: null });
  }
  return parts.filter((p) => p.text);
}

/** Whether the text contains at least one web address. */
export function hasLink(text: string) {
  return linkParts(text).some((p) => p.url);
}
