const LOCALE = "en-GB";

/** "Thu 14 May 2026" */
export function formatDate(iso: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString(
    LOCALE,
    options ?? { weekday: "short", day: "numeric", month: "short", year: "numeric" },
  );
}

/** "19:00" */
export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
}

/** "19:00 – 23:00" (or just the start time when there's no end). */
export function timeRange(start: string, end: string | null) {
  if (!end) return formatTime(start);
  const sameDay = new Date(start).toDateString() === new Date(end).toDateString();
  return `${formatTime(start)} – ${sameDay ? "" : `${formatDate(end, { day: "numeric", month: "short" })}, `}${formatTime(end)}`;
}

export type EventStatus = "upcoming" | "live" | "past";

/** Events without an end time count as over five hours after they start. */
const DEFAULT_LENGTH = 5 * 60 * 60 * 1000;

export function eventStatus(e: { starts_at: string; ends_at: string | null }, now = Date.now()): EventStatus {
  const start = Date.parse(e.starts_at);
  const end = e.ends_at ? Date.parse(e.ends_at) : start + DEFAULT_LENGTH;
  return now < start ? "upcoming" : now < end ? "live" : "past";
}

/** "today", "tomorrow", "in 3 days", "in 2 weeks", "last month"… */
export function fromNow(iso: string, now = new Date()) {
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((day(new Date(iso)) - day(now)) / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  if (Math.abs(days) < 7) return rtf.format(days, "day");
  if (Math.abs(days) < 30) return rtf.format(Math.round(days / 7), "week");
  if (Math.abs(days) < 365) return rtf.format(Math.round(days / 30), "month");
  return rtf.format(Math.round(days / 365), "year");
}

/** "Ava Jansen" → "AJ" */
export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .filter((_, i, all) => i === 0 || i === all.length - 1)
    .join("")
    .toUpperCase();
}

/** Only plain web links are ever turned into links. */
export function safeUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

const withProtocol = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v}`);

/** A link on the given site (e.g. "linkedin.com"), or null. */
function siteUrl(value: string, site: string) {
  const url = safeUrl(withProtocol(value));
  const host = url ? new URL(url).hostname : "";
  return host === site || host.endsWith(`.${site}`) ? url : null;
}

/** Accepts a profile link, "linkedin.com/in/name" or just "name". */
export function linkedinUrl(value: string | null | undefined) {
  const v = value?.trim();
  if (!v) return null;
  if (/^[\w-]+$/.test(v)) return `https://www.linkedin.com/in/${v}`;
  return siteUrl(v, "linkedin.com");
}

/** Accepts a profile link, "@handle" or "handle". */
export function instagramUrl(value: string | null | undefined) {
  const v = value?.trim();
  if (!v) return null;
  const handle = v.replace(/^@/, "");
  if (/^[\w.]+$/.test(handle)) return `https://www.instagram.com/${handle}/`;
  return siteUrl(v, "instagram.com");
}

/** Accepts "company.com" or a full link. */
export function websiteUrl(value: string | null | undefined) {
  const v = value?.trim();
  return v ? safeUrl(withProtocol(v)) : null;
}

/** "https://www.northwind.studio/about/" → "northwind.studio/about" */
export function prettyUrl(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
}

/** "@handle" for an Instagram link. */
export function instagramHandle(url: string) {
  const handle = url.match(/instagram\.com\/([\w.]+)/i)?.[1];
  return handle ? `@${handle}` : prettyUrl(url);
}

export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
