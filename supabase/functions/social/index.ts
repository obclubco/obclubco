// OBC Partners — social posting through Zernio (https://zernio.com).
// Runs as a Supabase Edge Function so the Zernio API key never reaches the browser.
// Only signed-in admins (allowed_emails.is_admin) can use it.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   ZERNIO_API_KEY   required — your Zernio API key
//   ALLOWED_ORIGINS  optional — comma-separated sites allowed to call this (default below)
// SUPABASE_URL and SUPABASE_ANON_KEY are provided by Supabase automatically.

const ZERNIO_URL = (Deno.env.get("ZERNIO_API_URL") ?? "https://zernio.com/api").replace(/\/$/, "");
const ZERNIO_KEY = Deno.env.get("ZERNIO_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://partner.obclub.co,http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

type Json = Record<string, unknown>;

function cors(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

/** Is the caller a signed-in admin? Asks the database with the caller's own token. */
async function requireAdmin(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) throw new HttpError(401, "Please log in.");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, authorization: auth, "content-type": "application/json" },
    body: "{}",
  });
  if (res.status === 401) throw new HttpError(401, "Your session has expired. Please log in again.");
  if (!res.ok || (await res.json()) !== true) throw new HttpError(403, "Only OBC admins can post to social media.");
  try {
    const payload = JSON.parse(atob(auth.slice(7).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return String(payload.email ?? "");
  } catch {
    return "";
  }
}

async function zernio(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  if (!ZERNIO_KEY) throw new HttpError(500, "ZERNIO_API_KEY is not set in Supabase → Edge Functions → Secrets.");
  const res = await fetch(`${ZERNIO_URL}${path}`, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${ZERNIO_KEY}`,
      "content-type": "application/json",
      ...init.headers,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text.slice(0, 300) };
  }
  if (!res.ok && res.status !== 207) {
    const d = data as Json | null;
    throw new HttpError(res.status >= 500 ? 502 : res.status, String(d?.error ?? d?.message ?? `Zernio error ${res.status}`), d);
  }
  return { status: res.status, data: data as Json };
}

const str = (v: unknown, max = 10000) => (typeof v === "string" ? v.slice(0, max) : undefined);

type PlatformInput = { platform: string; accountId: string; caption?: string; youtubeTitle?: string };

async function createPost(body: Json, email: string) {
  const content = str(body.content, 63000)?.trim() ?? "";
  const media = body.media as { url?: string; type?: string } | undefined;
  const platforms = Array.isArray(body.platforms) ? (body.platforms as PlatformInput[]) : [];
  const mode = body.mode as "now" | "schedule" | "draft";
  if (!platforms.length && mode !== "draft") throw new HttpError(400, "Choose at least one account.");
  if (!content && !media?.url && platforms.some((p) => !p.caption)) throw new HttpError(400, "Add a caption or a video.");
  if (media?.url && !/^https:\/\//.test(media.url)) throw new HttpError(400, "The video link must be https.");
  if (platforms.some((p) => p.platform === "tiktok") && body.tiktokConsent !== true) {
    throw new HttpError(400, "Please confirm the TikTok posting consent.");
  }

  const payload: Json = {
    content: content || undefined,
    mediaItems: media?.url ? [{ url: media.url, type: media.type === "image" ? "image" : "video" }] : undefined,
    platforms: platforms.map((p) => {
      const target: Json = { platform: String(p.platform), accountId: String(p.accountId) };
      const caption = str(p.caption, 63000)?.trim();
      if (caption) target.customContent = caption;
      if (p.platform === "youtube") {
        const title = str(p.youtubeTitle, 100)?.trim() || (caption || content).split("\n")[0].slice(0, 100) || "OBC";
        target.platformSpecificData = { title, visibility: "public" };
      }
      if (p.platform === "tiktok") {
        target.platformSpecificData = {
          privacyLevel: "PUBLIC_TO_EVERYONE",
          allowComment: true,
          allowDuet: true,
          allowStitch: true,
          contentPreviewConfirmed: true,
          expressConsentGiven: true,
        };
      }
      return target;
    }),
    metadata: { source: "obc-partners", createdBy: email },
  };
  if (mode === "now") payload.publishNow = true;
  else if (mode === "schedule") {
    const when = str(body.scheduledFor, 40);
    if (!when || Number.isNaN(Date.parse(when))) throw new HttpError(400, "Pick a date and time to schedule.");
    if (Date.parse(when) < Date.now() - 60_000) throw new HttpError(400, "The scheduled time is in the past.");
    payload.scheduledFor = when;
    payload.timezone = str(body.timezone, 60) || "UTC";
  } else payload.isDraft = true;

  const key = str(body.idempotencyKey, 200);
  const { status, data } = await zernio("/v1/posts", {
    method: "POST",
    body: payload,
    headers: key ? { "Idempotency-Key": key } : {},
  });
  return { partial: status === 207, ...data };
}

async function handle(req: Request): Promise<Json> {
  const email = await requireAdmin(req);
  const body = ((await req.json().catch(() => ({}))) ?? {}) as Json;

  switch (body.action) {
    case "accounts": {
      const { data } = await zernio("/v1/accounts");
      const accounts = ((data.accounts as Json[]) ?? []).map((a) => ({
        id: a._id,
        platform: a.platform,
        username: a.username ?? null,
        displayName: a.displayName ?? null,
        avatar: a.profilePicture ?? null,
        needsReconnection: !!a.needsReconnection,
        active: a.isActive !== false && a.enabled !== false,
      }));
      return { accounts };
    }
    case "presign": {
      const filename = str(body.filename, 200) ?? "video.mp4";
      const contentType = str(body.contentType, 100) ?? "";
      if (!/^(video|image)\//.test(contentType)) throw new HttpError(400, "Only videos and images can be uploaded.");
      const size = typeof body.size === "number" ? body.size : undefined;
      const { data } = await zernio("/v1/media/presign", { method: "POST", body: { filename, contentType, size } });
      return { uploadUrl: data.uploadUrl, publicUrl: data.publicUrl };
    }
    case "post":
      return await createPost(body, email);
    case "posts": {
      const { data } = await zernio("/v1/posts?limit=20&sortBy=created-desc");
      return { posts: (data.posts as Json[]) ?? [] };
    }
    case "retry": {
      const id = str(body.postId, 100);
      if (!id || !/^[\w-]+$/.test(id)) throw new HttpError(400, "Missing post.");
      const { data } = await zernio(`/v1/posts/${id}/retry`, { method: "POST", body: {} });
      return data;
    }
    default:
      throw new HttpError(400, "Unknown action.");
  }
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get("origin")), "content-type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  try {
    return new Response(JSON.stringify(await handle(req)), { headers });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof HttpError ? e.message : "Something went wrong. Please try again.";
    if (!(e instanceof HttpError)) console.error(e);
    return new Response(JSON.stringify({ error: message, details: e instanceof HttpError ? e.details : undefined }), {
      status,
      headers,
    });
  }
});
