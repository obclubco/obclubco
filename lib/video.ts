import { createClient } from "@/lib/supabase/server";

export type VideoSource = { kind: "embed"; src: string } | { kind: "file"; src: string };

/**
 * Turns a lesson's video_url into something playable.
 * Supports YouTube, Vimeo, Loom, direct files, and "storage:<path>" (private Supabase bucket).
 */
export async function resolveVideo(url: string): Promise<VideoSource | null> {
  const trimmed = url.trim();

  if (trimmed.startsWith("storage:")) {
    const supabase = await createClient();
    const path = trimmed.slice("storage:".length).replace(/^\/+/, "");
    const { data } = await supabase.storage.from("lesson-videos").createSignedUrl(path, 60 * 60 * 4);
    return data?.signedUrl ? { kind: "file", src: data.signedUrl } : null;
  }

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");

  if (host === "youtu.be") return youtube(u.pathname.slice(1));
  if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    const id = u.searchParams.get("v") ?? u.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1];
    if (id) return youtube(id);
  }
  if (host.endsWith("vimeo.com")) {
    const id = u.pathname.match(/(\d+)/)?.[1];
    const hash = u.pathname.match(/\/\d+\/([a-z0-9]+)/i)?.[1] ?? u.searchParams.get("h");
    if (id) return { kind: "embed", src: `https://player.vimeo.com/video/${id}?dnt=1${hash ? `&h=${hash}` : ""}` };
  }
  if (host.endsWith("loom.com")) {
    const id = u.pathname.match(/\/(?:share|embed)\/([a-z0-9]+)/i)?.[1];
    if (id) return { kind: "embed", src: `https://www.loom.com/embed/${id}` };
  }
  return { kind: "file", src: trimmed };
}

function youtube(id: string): VideoSource {
  return { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1` };
}
