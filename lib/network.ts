import { supabase } from "@/lib/supabase";

/** Profile fields every guest can fill in (and edit on the Profile page). */
export type ProfileFields = {
  full_name: string;
  role: string | null;
  company: string | null;
  city: string | null;
  photo_url: string | null;
  bio: string | null;
  interests: string[];
  looking_for: string | null;
  can_help_with: string | null;
  linkedin: string | null;
  instagram: string | null;
  website: string | null;
  phone: string | null;
  share_contact: boolean;
  is_visible: boolean;
};

/** The signed-in guest's own row. */
export type Me = ProfileFields & { id: string; email: string; is_admin: boolean };

/** Another guest, as the signed-in guest sees them (from get_network). */
export type Guest = Omit<ProfileFields, "share_contact"> & {
  id: string;
  /** Only filled in when the guest shares their contact details (or for admins). */
  email: string | null;
  /** Events this guest shares with the signed-in guest, newest first (admins: all of theirs). */
  event_ids: string[];
};

/** What a profile page shows, for another guest or as a preview of your own. */
export type PublicProfile = Omit<Guest, "id" | "event_ids" | "is_visible"> & { is_visible?: boolean };

export type NetEvent = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  cover_image_url: string | null;
  is_published: boolean;
  /** Whether the signed-in guest is on this event's guest list (admins also see other events). */
  attending: boolean;
  guest_count: number;
};

export type AdminGuest = {
  id: string;
  email: string;
  full_name: string;
  role: string | null;
  company: string | null;
  is_admin: boolean;
  is_visible: boolean;
  created_at: string;
  events: number;
  last_event_at: string | null;
  has_login: boolean;
  last_sign_in_at: string | null;
};

export type AddGuestsResult = { added: number; created: number; missing: string[] };

const ME_COLUMNS =
  "id, email, is_admin, full_name, role, company, city, photo_url, bio, interests, looking_for, can_help_with, linkedin, instagram, website, phone, share_contact, is_visible";

// Pages share what they load for a minute, so moving around the site is instant.
const cache = new Map<string, { at: number; value: Promise<unknown> }>();
function cached<T>(key: string, load: () => Promise<T>, maxAge = 60_000): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < maxAge) return hit.value as Promise<T>;
  const value = load();
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.delete(key));
  return value;
}
/** Forget loaded data (after a change, or when someone signs out). */
export function clearCache() {
  cache.clear();
}

/** The signed-in guest, or why not: "signed_out" | "not_on_list". */
export async function loadMe(): Promise<Me | "signed_out" | "not_on_list"> {
  const {
    data: { session },
  } = await supabase().auth.getSession();
  if (!session) return "signed_out";
  const email = (session.user.email ?? "").toLowerCase();
  const { data, error } = await supabase().from("guests").select(ME_COLUMNS).eq("email", email).maybeSingle();
  if (error) throw error;
  return data ? (data as Me) : "not_on_list";
}

export function getMyEvents(): Promise<NetEvent[]> {
  return cached("events", async () => {
    const { data, error } = await supabase().rpc("get_my_events");
    if (error) throw error;
    return (data ?? []) as NetEvent[];
  });
}

export function getNetwork(): Promise<Guest[]> {
  return cached("network", async () => {
    const { data, error } = await supabase().rpc("get_network");
    if (error) throw error;
    return ((data ?? []) as Guest[]).map((g) => ({ ...g, interests: g.interests ?? [], event_ids: g.event_ids ?? [] }));
  });
}

export async function updateProfile(id: string, fields: Partial<ProfileFields>): Promise<Me> {
  const { data, error } = await supabase().from("guests").update(fields).eq("id", id).select(ME_COLUMNS).single();
  if (error) throw error;
  return data as Me;
}

// ── Profile photos (Supabase Storage bucket "guest-photos", one folder per guest) ──

const PHOTO_BUCKET = "guest-photos";

/** Uploads a photo into the guest's folder and returns its public link. */
export async function uploadPhoto(guestId: string, photo: Blob): Promise<string> {
  const path = `${guestId}/${Date.now()}.jpg`;
  const { error } = await supabase()
    .storage.from(PHOTO_BUCKET)
    .upload(path, photo, { contentType: photo.type || "image/jpeg", cacheControl: "31536000" });
  if (error) throw error;
  return supabase().storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Deletes a previously uploaded photo (links to anywhere else are left alone). */
export async function deletePhoto(guestId: string, url: string | null) {
  const marker = `/storage/v1/object/public/${PHOTO_BUCKET}/`;
  const path = url?.includes(marker) ? decodeURIComponent(url.split(marker)[1].split("?")[0]) : null;
  if (path?.startsWith(`${guestId}/`)) await supabase().storage.from(PHOTO_BUCKET).remove([path]);
}

// ── Admins ──

export async function getAdminOverview(): Promise<AdminGuest[]> {
  const { data, error } = await supabase().rpc("admin_guest_overview");
  if (error) throw error;
  return (data ?? []) as AdminGuest[];
}

export async function addEventGuests(
  eventId: string,
  guests: { email: string; full_name?: string; company?: string }[],
): Promise<AddGuestsResult> {
  const { data, error } = await supabase().rpc("add_event_guests", { p_event_id: eventId, p_guests: guests });
  clearCache();
  if (error) throw error;
  return data as AddGuestsResult;
}

export async function removeEventGuest(eventId: string, guestId: string) {
  const { error } = await supabase().from("event_guests").delete().eq("event_id", eventId).eq("guest_id", guestId);
  clearCache();
  if (error) throw error;
}

// ── Helpers ──

/** What's still missing from a profile, to nudge people to complete it. */
export function profileChecklist(p: ProfileFields) {
  return [
    { label: "a photo", done: !!p.photo_url },
    { label: "your role and company", done: !!(p.role && p.company) },
    { label: "a short bio", done: !!p.bio },
    { label: "your interests", done: p.interests.length > 0 },
    { label: "what you're looking for", done: !!(p.looking_for || p.can_help_with) },
    { label: "a link", done: !!(p.linkedin || p.instagram || p.website) },
  ];
}

/** "Founder & CEO · Northwind Studio" */
export function roleLine(p: { role: string | null; company: string | null }) {
  return [p.role, p.company].filter(Boolean).join(" · ");
}

/** Search across what people write about themselves. Every word must match somewhere. */
export function matchesQuery(g: Guest, query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = [g.full_name, g.role, g.company, g.city, g.looking_for, g.can_help_with, ...g.interests]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return words.every((w) => text.includes(w));
}

/**
 * Where you know someone from: the events you were both on the list for (newest first), split into
 * past and upcoming. For admins, `all` also counts events they weren't at themselves.
 */
export function sharedWith(g: Guest, eventsById: Map<string, NetEvent>, now = Date.now()) {
  const all = g.event_ids.map((id) => eventsById.get(id)).filter((e): e is NetEvent => !!e);
  const together = all.filter((e) => e.attending);
  const past = together.filter((e) => Date.parse(e.starts_at) <= now);
  const upcoming = together.filter((e) => Date.parse(e.starts_at) > now).reverse();
  return { all, together, past, upcoming, lastMet: past[0] ?? null };
}

/** "Met at Founders Dinner · 2 events together", "Also going to Deal-Flow Night", or for admins "3 events". */
export function guestNote(g: Guest, eventsById: Map<string, NetEvent>) {
  const { all, together, lastMet, upcoming } = sharedWith(g, eventsById);
  if (lastMet) return `Met at ${lastMet.title}${together.length > 1 ? ` · ${together.length} events together` : ""}`;
  if (upcoming.length) return `Also going to ${upcoming[0].title}`;
  return `${all.length} ${all.length === 1 ? "event" : "events"}${all[0] ? ` · last: ${all[0].title}` : ""}`;
}

/** Most recently met first, then people you'll meet soon, then everyone else; by name within each. */
export function byMostRecent(eventsById: Map<string, NetEvent>) {
  const key = (g: Guest) => {
    const { lastMet, upcoming, all } = sharedWith(g, eventsById);
    if (lastMet) return [0, -Date.parse(lastMet.starts_at)];
    if (upcoming.length) return [1, Date.parse(upcoming[0].starts_at)];
    return [2, all[0] ? -Date.parse(all[0].starts_at) : 0];
  };
  return (a: Guest, b: Guest) => {
    const [ka, kb] = [key(a), key(b)];
    return ka[0] - kb[0] || ka[1] - kb[1] || a.full_name.localeCompare(b.full_name);
  };
}

const EMAIL = /[^\s<>(),;:"']+@[^\s<>(),;:"']+\.[^\s<>(),;:"']+/;

/**
 * Reads a pasted guest list: one person per line, an email plus optionally a name and company,
 * e.g. "ava@example.com", "Jane Doe, jane@acme.com, Acme", "Jane Doe <jane@acme.com>" or spreadsheet columns.
 */
export function parseGuestLines(text: string) {
  const rows: { email: string; full_name?: string; company?: string }[] = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const email = line.match(EMAIL)?.[0];
    if (!email) {
      skipped++;
      continue;
    }
    const [full_name, company] = line
      .replace(email, " ")
      .replace(/[<>"]/g, " ")
      .split(/[,;\t]/)
      .map((s) => s.trim())
      .filter(Boolean);
    rows.push({ email: email.toLowerCase(), ...(full_name && { full_name }), ...(company && { company }) });
  }
  return { rows, skipped };
}
