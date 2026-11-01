import { isSetupMissing } from "@/lib/applications";
import { supabase } from "@/lib/supabase";

/**
 * Photos and videos of an event (0010_event_media.sql). The files are in the private Storage bucket "event-media",
 * one folder per event, and are opened through links that expire; the `event_media` table says which belong where.
 */

export type EventMedia = {
  id: string;
  event_id: string;
  kind: "photo" | "video";
  path: string;
  /** A small JPEG for the grid (photos, and videos this browser could read when they were added). */
  thumb_path: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  seconds: number | null;
  created_at: string;
};

export const MEDIA_BUCKET = "event-media";
/** The bucket's limit per file: the most the Supabase free plan allows. */
export const MEDIA_MAX_BYTES = 50 * 1024 * 1024;
const PHOTO_MAX = 2048; // px on the longest side: sharp full screen, a few hundred KB
const THUMB_MAX = 640; // px: the grid
const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };

/** The event's photos and videos, in the order they were added; null before 0010_event_media.sql has been run. */
export async function getEventMedia(eventId: string): Promise<EventMedia[] | null> {
  const { data, error } = await supabase()
    .from("event_media")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error && isSetupMissing(error.message)) return null;
  if (error) throw error;
  return (data ?? []) as EventMedia[];
}

// ── Links to the files ──
// Signed links work for a few hours. The same link is reused while it's good, so the browser can cache the file.

const LINK_HOURS = 6;
const REUSE_MS = 30 * 60 * 1000; // a link with less than this left gets replaced
const LINKS_KEY = "obcn-media-links";
let links: Record<string, { url: string; until: number }> | null = null;

function savedLinks() {
  if (!links) {
    try {
      links = JSON.parse(localStorage.getItem(LINKS_KEY) ?? "{}");
    } catch {
      links = {};
    }
  }
  return links!;
}

/** Links for opening these files (missing ones: the file is gone, or this person can't see it). */
export async function mediaLinks(paths: string[]): Promise<Map<string, string>> {
  const saved = savedLinks();
  const now = Date.now();
  const needed = [...new Set(paths)].filter((p) => !(saved[p] && saved[p].until - now > REUSE_MS));
  if (needed.length) {
    const { data, error } = await supabase().storage.from(MEDIA_BUCKET).createSignedUrls(needed, LINK_HOURS * 3600);
    if (error) throw error;
    for (const d of data ?? []) if (d.path && d.signedUrl) saved[d.path] = { url: d.signedUrl, until: now + LINK_HOURS * 3600_000 };
    for (const [p, l] of Object.entries(saved)) if (l.until < now) delete saved[p];
    try {
      localStorage.setItem(LINKS_KEY, JSON.stringify(saved));
    } catch {
      // Private browsing: links are just asked for again next time.
    }
  }
  return new Map(paths.filter((p) => saved[p]).map((p) => [p, saved[p].url]));
}

/** A link that downloads the file under a readable name. */
export async function downloadLink(m: EventMedia, name: string) {
  const { data, error } = await supabase().storage.from(MEDIA_BUCKET).createSignedUrl(m.path, 600, { download: name });
  if (error) throw error;
  return data.signedUrl;
}

// ── Adding and removing (admins) ──

const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;
const isVideo = (f: File) => f.type.startsWith("video/") || /\.(mp4|m4v|mov|webm)$/i.test(f.name);

/** Why a file can't be added, in words, or null when it can. */
export function mediaProblem(file: File): string | null {
  if (file.type.startsWith("image/")) return null;
  if (isVideo(file)) {
    return file.size > MEDIA_MAX_BYTES
      ? `${file.name} is ${mb(file.size)}: videos can be up to ${mb(MEDIA_MAX_BYTES)}. Trim it or export it smaller.`
      : null;
  }
  return `${file.name} isn't a photo or a video.`;
}

type Prepared = {
  kind: "photo" | "video";
  file: Blob;
  type: string;
  ext: string;
  thumb: Blob | null;
  width: number | null;
  height: number | null;
  seconds: number | null;
};

/** Draws an image or a video frame at most `max` px on its longest side, as a JPEG. */
function toJpeg(source: CanvasImageSource, width: number, height: number, max: number, quality: number) {
  const scale = Math.min(1, max / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise<{ blob: Blob; width: number; height: number }>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve({ blob, width: canvas.width, height: canvas.height }) : reject(new Error("UNREADABLE"))),
      "image/jpeg",
      quality,
    ),
  );
}

async function preparePhoto(file: File): Promise<Prepared> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`${file.name} couldn't be read here. Try it as a JPG or PNG.`);
  }
  try {
    const full = await toJpeg(bitmap, bitmap.width, bitmap.height, PHOTO_MAX, 0.85);
    const thumb = await toJpeg(bitmap, bitmap.width, bitmap.height, THUMB_MAX, 0.8);
    return { kind: "photo", file: full.blob, type: "image/jpeg", ext: "jpg", thumb: thumb.blob, width: full.width, height: full.height, seconds: null };
  } finally {
    bitmap.close();
  }
}

/** A still from half a second in, with the video's size and length. Rejects when this browser can't play it. */
function videoFrame(file: File) {
  return new Promise<{ blob: Blob; width: number; height: number; seconds: number | null }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const finish = (then: () => void) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      then();
    };
    const timer = setTimeout(() => finish(() => reject(new Error("TIMEOUT"))), 10_000);
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onerror = () => finish(() => reject(new Error("UNPLAYABLE")));
    video.onloadedmetadata = () => {
      video.currentTime = Number.isFinite(video.duration) ? Math.min(0.5, video.duration / 2) : 0.5;
    };
    video.onseeked = () => {
      toJpeg(video, video.videoWidth, video.videoHeight, THUMB_MAX, 0.8).then(
        (still) =>
          finish(() =>
            resolve({
              blob: still.blob,
              width: video.videoWidth,
              height: video.videoHeight,
              seconds: Number.isFinite(video.duration) ? Math.round(video.duration * 10) / 10 : null,
            }),
          ),
        (e) => finish(() => reject(e)),
      );
    };
    video.src = url;
  });
}

async function prepareVideo(file: File): Promise<Prepared> {
  const named = Object.entries(VIDEO_TYPES).find(([, ext]) => file.name.toLowerCase().endsWith(`.${ext}`))?.[0];
  const type = VIDEO_TYPES[file.type] ? file.type : (named ?? "video/mp4");
  // Videos this browser can't play (e.g. some iPhone formats in Chrome) still go up, just without a still.
  const still = await videoFrame(file).catch(() => null);
  return {
    kind: "video",
    file,
    type,
    ext: VIDEO_TYPES[type],
    thumb: still?.blob ?? null,
    width: still?.width || null,
    height: still?.height || null,
    seconds: still?.seconds ?? null,
  };
}

/** Prepares a photo (resized) or video, uploads it with its preview and adds it to the event. */
export async function addEventMedia(eventId: string, file: File): Promise<EventMedia> {
  const problem = mediaProblem(file);
  if (problem) throw new Error(problem);
  const p = isVideo(file) ? await prepareVideo(file) : await preparePhoto(file);
  const id = crypto.randomUUID();
  const path = `${eventId}/${id}.${p.ext}`;
  const thumbPath = p.thumb ? `${eventId}/${id}.thumb.jpg` : null;
  const bucket = supabase().storage.from(MEDIA_BUCKET);
  const uploaded = await bucket.upload(path, p.file, { contentType: p.type, cacheControl: "31536000" });
  if (uploaded.error) throw uploaded.error;
  try {
    if (p.thumb && thumbPath) {
      const preview = await bucket.upload(thumbPath, p.thumb, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (preview.error) throw preview.error;
    }
    const { data, error } = await supabase().rpc("add_event_media", {
      p_event_id: eventId,
      p_kind: p.kind,
      p_path: path,
      p_thumb_path: thumbPath,
      p_width: p.width,
      p_height: p.height,
      p_bytes: p.file.size,
      p_seconds: p.seconds,
    });
    if (error) throw error;
    return data as EventMedia;
  } catch (e) {
    await bucket.remove([path, ...(thumbPath ? [thumbPath] : [])]); // don't leave files nobody can see
    throw e;
  }
}

/** Takes a photo or video off the event, and deletes its files. */
export async function deleteEventMedia(m: EventMedia) {
  const { data, error } = await supabase().rpc("delete_event_media", { p_id: m.id });
  if (error) throw error;
  const files = (data as string[] | null) ?? [];
  if (files.length) await supabase().storage.from(MEDIA_BUCKET).remove(files);
}

/** "0:42", "12:05" */
export function duration(seconds: number | null) {
  if (seconds === null) return null;
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
