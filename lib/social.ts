import { supabase } from "@/lib/supabase";

/** A social account connected in Zernio. */
export type SocialAccount = {
  id: string;
  platform: string;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
  needsReconnection: boolean;
  active: boolean;
};

export type PlatformResult = {
  platform?: string;
  status?: string;
  platformPostUrl?: string | null;
  errorMessage?: string;
  accountId?: string | { username?: string; displayName?: string };
};

export type SocialPost = {
  _id?: string;
  content?: string;
  status?: string;
  scheduledFor?: string;
  createdAt?: string;
  mediaItems?: { url?: string; type?: string }[];
  platforms?: PlatformResult[];
};

export type PostRequest = {
  content: string;
  media?: { url: string; type: "video" | "image" };
  platforms: { platform: string; accountId: string; caption?: string; youtubeTitle?: string }[];
  mode: "now" | "schedule" | "draft";
  scheduledFor?: string;
  timezone?: string;
  tiktokConsent?: boolean;
  idempotencyKey: string;
};

/** Caption length limits per platform (characters). */
export const CAPTION_LIMIT: Record<string, number> = {
  twitter: 280,
  bluesky: 300,
  threads: 500,
  pinterest: 500,
  googlebusiness: 1500,
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
  telegram: 4096,
  youtube: 5000,
  facebook: 63206,
};
export const DEFAULT_LIMIT = 5000;

export const PLATFORM_LABEL: Record<string, string> = {
  twitter: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  threads: "Threads",
  pinterest: "Pinterest",
  bluesky: "Bluesky",
  reddit: "Reddit",
  googlebusiness: "Google Business",
  telegram: "Telegram",
  snapchat: "Snapchat",
};

/** Platforms that can't post without a video or image. */
export const NEEDS_MEDIA = new Set(["instagram", "tiktok", "youtube", "pinterest", "snapchat"]);

/** Calls the `social` Edge Function (it checks you're an admin and talks to Zernio). */
async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase().functions.invoke("social", { body: { action, ...payload } });
  if (error) {
    let message = error.message;
    try {
      const body = await (error as { context?: Response }).context?.json();
      if (body?.error) message = body.error;
    } catch {}
    if (/failed to send a request|fetch/i.test(message)) {
      message = "Couldn't reach the social posting service. Is the `social` Edge Function deployed?";
    }
    throw new Error(message);
  }
  return data as T;
}

export const getAccounts = () => call<{ accounts: SocialAccount[] }>("accounts").then((r) => r.accounts);
export const getPosts = () => call<{ posts: SocialPost[] }>("posts").then((r) => r.posts);
export const createPost = (req: PostRequest) =>
  call<{ post?: SocialPost; partial?: boolean; warnings?: string[] }>("post", req);
export const retryPost = (postId: string) => call("retry", { postId });

function put(url: string, file: File, headers: Record<string, string>, onProgress: (p: number) => void, method = "PUT") {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(Object.assign(new Error(`Upload failed (${xhr.status})`), { status: xhr.status })));
    xhr.onerror = () => reject(Object.assign(new Error("Upload blocked or network error"), { status: 0 }));
    xhr.send(file);
  });
}

/**
 * Uploads a video/image and returns a public https link for Zernio.
 * First tries Zernio's own storage (large files, straight from the browser); if the browser can't upload
 * there, falls back to the public `social-media` bucket in Supabase Storage.
 */
export async function uploadMedia(file: File, onProgress: (p: number) => void): Promise<{ url: string; via: "zernio" | "supabase" }> {
  const contentType = file.type || "video/mp4";
  const { uploadUrl, publicUrl } = await call<{ uploadUrl: string; publicUrl: string }>("presign", {
    filename: file.name,
    contentType,
    size: file.size,
  });
  try {
    await put(uploadUrl, file, { "Content-Type": contentType }, onProgress);
    return { url: publicUrl, via: "zernio" };
  } catch (e) {
    if ((e as { status?: number }).status !== 0) throw e;
  }

  // Fallback: Supabase Storage (public bucket, admins only can upload)
  onProgress(0);
  const sb = supabase();
  const { data } = await sb.auth.getSession();
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "") || "video.mp4";
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;
  try {
    await put(
      `${base}/storage/v1/object/social-media/${path}`,
      file,
      {
        authorization: `Bearer ${data.session?.access_token ?? ""}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        "content-type": contentType,
        "x-upsert": "false",
      },
      onProgress,
      "POST",
    );
  } catch (e) {
    if ((e as { status?: number }).status === 413) {
      throw new Error("This file is too large for the backup upload (Supabase plan file-size limit).");
    }
    throw e;
  }
  return { url: `${base}/storage/v1/object/public/social-media/${path}`, via: "supabase" };
}
