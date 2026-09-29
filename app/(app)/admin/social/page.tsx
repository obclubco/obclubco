"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMember } from "@/components/MemberGate";
import { ProgressBar } from "@/components/ProgressBar";
import { SplitWords } from "@/components/SplitWords";
import { Loading } from "@/components/States";
import { Arrow, DrawCheck } from "@/components/Icons";
import { errorMessage, useLoad, usePageTitle } from "@/lib/hooks";
import {
  CAPTION_LIMIT,
  DEFAULT_LIMIT,
  NEEDS_MEDIA,
  PLATFORM_LABEL,
  createPost,
  getAccounts,
  getPosts,
  retryPost,
  uploadMedia,
  type PlatformResult,
  type SocialAccount,
  type SocialPost,
} from "@/lib/social";

type Mode = "now" | "schedule" | "draft";

const label = (p: string) => PLATFORM_LABEL[p] ?? p.charAt(0).toUpperCase() + p.slice(1);
const limitFor = (p: string) => CAPTION_LIMIT[p] ?? DEFAULT_LIMIT;
const fmtSize = (b: number) => (b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(b / 1e6))} MB`);
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

export default function SocialPage() {
  const member = useMember();
  const router = useRouter();
  usePageTitle("Social");
  useEffect(() => {
    if (!member.isAdmin) router.replace("/dashboard/");
  }, [member.isAdmin, router]);

  const accounts = useLoad(getAccounts, []);
  const history = useLoad(getPosts, []);

  if (!member.isAdmin) return <Loading />;

  return (
    <div className="container-x py-12 sm:py-16">
      <Link href="/admin/" className="enter text-sm text-mute transition hover:text-bone">
        ← Admin
      </Link>
      <p className="eyebrow enter mt-8">Social media</p>
      <h1 className="display mt-4 text-5xl sm:text-6xl">
        <SplitWords text="Post Everywhere." delay={100} step={110} />
      </h1>
      <p className="enter mt-4 max-w-2xl text-sm leading-6 text-mute" style={{ "--d": "300ms" } as React.CSSProperties}>
        Upload a video once, write the caption, pick the accounts and publish to all of them at once, or schedule it.
        Accounts are connected in your{" "}
        <a href="https://zernio.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-bone underline decoration-line underline-offset-4 hover:decoration-bone">
          Zernio dashboard
        </a>
        .
      </p>

      {accounts.error ? (
        <div className="card mt-10 p-6">
          <p className="text-sm text-bad">{accounts.error}</p>
          <p className="mt-3 text-xs leading-5 text-mute">
            Check that the <code className="text-bone">social</code> Edge Function is deployed and the{" "}
            <code className="text-bone">ZERNIO_API_KEY</code> secret is set in Supabase (see the README, “Social posting”).
          </p>
        </div>
      ) : accounts.loading || !accounts.data ? (
        <Loading />
      ) : (
        <Composer accounts={accounts.data} onPosted={history.reload} />
      )}

      <History state={history} />
    </div>
  );
}

function Composer({ accounts, onPosted }: { accounts: SocialAccount[]; onPosted: () => void }) {
  const usable = accounts.filter((a) => a.active);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [ytTitle, setYtTitle] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(usable.filter((a) => !a.needsReconnection).map((a) => a.id)));
  const [mode, setMode] = useState<Mode>("now");
  const [when, setWhen] = useState("");
  const [tiktokOk, setTiktokOk] = useState(false);
  const [phase, setPhase] = useState<"idle" | "uploading" | "posting" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ post?: SocialPost; partial?: boolean; warnings?: string[] } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const idempotencyKey = useRef(crypto.randomUUID());

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const chosen = usable.filter((a) => selected.has(a.id));
  const platforms = [...new Set(chosen.map((a) => a.platform))];
  const hasTikTok = platforms.includes("tiktok");
  const hasYouTube = platforms.includes("youtube");
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const problems = useMemo(() => {
    const list: string[] = [];
    if (!chosen.length && mode !== "draft") list.push("Choose at least one account.");
    for (const p of platforms) {
      const text = (custom[p] ?? "").trim() || caption.trim();
      if (text.length > limitFor(p)) list.push(`${label(p)} caption is too long (${text.length}/${limitFor(p)}).`);
      if (NEEDS_MEDIA.has(p) && !file) list.push(`${label(p)} needs a video or image.`);
    }
    if (!file && !caption.trim() && mode !== "draft") list.push("Add a video or a caption.");
    if (hasTikTok && !tiktokOk && mode !== "draft") list.push("Confirm the TikTok consent below.");
    if (mode === "schedule" && (!when || new Date(when).getTime() < Date.now())) list.push("Pick a future date and time.");
    return list;
  }, [chosen.length, platforms, custom, caption, file, hasTikTok, tiktokOk, mode, when]);

  function pickFile(f: File | undefined | null) {
    if (!f) return;
    if (!/^(video|image)\//.test(f.type)) return setError("Please choose a video or image file.");
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function submit() {
    if (problems.length) return setError(problems[0]);
    setError(null);
    setResult(null);
    try {
      let media: { url: string; type: "video" | "image" } | undefined;
      if (file) {
        setPhase("uploading");
        setProgress(0);
        const up = await uploadMedia(file, setProgress);
        media = { url: up.url, type: file.type.startsWith("image/") ? "image" : "video" };
      }
      setPhase("posting");
      const res = await createPost({
        content: caption.trim(),
        media,
        platforms: chosen.map((a) => ({
          platform: a.platform,
          accountId: a.id,
          caption: custom[a.platform]?.trim() || undefined,
          youtubeTitle: a.platform === "youtube" ? ytTitle.trim() || undefined : undefined,
        })),
        mode,
        scheduledFor: mode === "schedule" ? new Date(when).toISOString() : undefined,
        timezone: tz,
        tiktokConsent: hasTikTok ? tiktokOk : undefined,
        idempotencyKey: idempotencyKey.current,
      });
      setResult(res);
      setPhase("done");
      onPosted();
    } catch (e) {
      setError(errorMessage(e));
      setPhase("idle");
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setCaption("");
    setCustom({});
    setOpen({});
    setYtTitle("");
    setWhen("");
    setTiktokOk(false);
    setResult(null);
    setPhase("idle");
    idempotencyKey.current = crypto.randomUUID();
  }

  const busy = phase === "uploading" || phase === "posting";

  if (phase === "done" && result) return <Result result={result} mode={mode} onNew={reset} />;

  return (
    <div className="mt-12 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
      {/* 1. Video */}
      <section data-reveal className="card glow-card p-6 sm:p-7">
        <Step n={1} title="Video" />
        <input ref={fileInput} type="file" accept="video/*,image/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
        {preview && file ? (
          <div className="mt-5">
            <div className="overflow-hidden rounded-xl border border-line bg-black">
              {file.type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="max-h-[420px] w-full object-contain" />
              ) : (
                <video src={preview} controls playsInline className="max-h-[420px] w-full" />
              )}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-mute">
              <span className="truncate">
                {file.name} · {fmtSize(file.size)}
              </span>
              <button onClick={() => fileInput.current?.click()} disabled={busy} className="shrink-0 text-bone underline-offset-4 hover:underline">
                Replace
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pickFile(e.dataTransfer.files?.[0]);
            }}
            className="mt-5 grid w-full place-items-center rounded-xl border border-dashed border-line bg-elevated/40 px-6 py-16 text-center transition duration-300 hover:border-bone/40 hover:bg-elevated"
          >
            <svg viewBox="0 0 24 24" className="size-8 text-mute" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M5 20h14" />
            </svg>
            <span className="mt-4 text-sm">Drop a video here or click to choose</span>
            <span className="mt-1 text-xs text-mute">MP4 or MOV works everywhere · images work too</span>
          </button>
        )}
      </section>

      {/* 2. Caption */}
      <section data-reveal className="card glow-card p-6 sm:p-7">
        <Step n={2} title="Caption" />
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={7}
          placeholder="Write the caption… hashtags go right in the text."
          className="mt-5 w-full resize-y rounded-2xl border border-line bg-elevated px-5 py-4 text-sm leading-6 text-bone outline-none transition duration-300 placeholder:text-mute/70 focus:border-bone/60"
        />
        <p className="mt-2 text-right text-xs text-mute">{caption.length} characters</p>

        {platforms.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-mute">Same caption everywhere, or tailor it per platform:</p>
            {platforms.map((p) => {
              const text = (custom[p] ?? "").trim() || caption.trim();
              const over = text.length > limitFor(p);
              return (
                <div key={p} className="rounded-xl border border-line">
                  <button
                    onClick={() => setOpen((o) => ({ ...o, [p]: !o[p] }))}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm"
                  >
                    <span>
                      {label(p)}
                      {custom[p]?.trim() ? <span className="ml-2 text-xs text-mute">custom</span> : null}
                    </span>
                    <span className={`text-xs ${over ? "text-bad" : "text-mute"}`}>
                      {text.length}/{limitFor(p)} {open[p] ? "▴" : "▾"}
                    </span>
                  </button>
                  {open[p] && (
                    <div className="border-t border-line p-3">
                      {p === "youtube" && (
                        <input
                          value={ytTitle}
                          onChange={(e) => setYtTitle(e.target.value.slice(0, 100))}
                          placeholder="YouTube title (defaults to the caption's first line)"
                          className="input mb-2 rounded-xl"
                        />
                      )}
                      <textarea
                        value={custom[p] ?? ""}
                        onChange={(e) => setCustom((c) => ({ ...c, [p]: e.target.value }))}
                        rows={4}
                        placeholder={`Leave empty to use the main caption on ${label(p)}`}
                        className="w-full resize-y rounded-xl border border-line bg-elevated px-4 py-3 text-sm leading-6 text-bone outline-none transition duration-300 placeholder:text-mute/70 focus:border-bone/60"
                      />
                    </div>
                  )}
                </div>
              );
            })}
            {hasYouTube && !open.youtube && (
              <p className="text-xs text-mute">Tip: open YouTube above to set the video title.</p>
            )}
          </div>
        )}
      </section>

      {/* 3. Accounts */}
      <section data-reveal className="card glow-card p-6 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <Step n={3} title="Accounts" />
          {usable.length > 1 && (
            <button
              onClick={() => setSelected(new Set(chosen.length === usable.length ? [] : usable.map((a) => a.id)))}
              className="text-xs text-mute transition hover:text-bone"
            >
              {chosen.length === usable.length ? "Select none" : "Select all"}
            </button>
          )}
        </div>
        {usable.length === 0 ? (
          <p className="mt-5 text-sm leading-6 text-mute">
            No accounts connected yet. Connect Instagram, TikTok, YouTube and others in your{" "}
            <a href="https://zernio.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-bone underline underline-offset-4">
              Zernio dashboard
            </a>
            , then reload this page.
          </p>
        ) : (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {usable.map((a) => {
              const on = selected.has(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => toggle(a.id)}
                  aria-pressed={on}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition duration-300 ${
                    on ? "border-bone/60 bg-bone/[0.06]" : "border-line hover:border-bone/30"
                  }`}
                >
                  {a.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.avatar} alt="" className="size-9 rounded-full border border-line object-cover" />
                  ) : (
                    <span className="grid size-9 place-items-center rounded-full border border-line text-xs">{label(a.platform).charAt(0)}</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm">{label(a.platform)}</span>
                    <span className="block truncate text-xs text-mute">
                      {a.needsReconnection ? "Needs reconnecting in Zernio" : a.username ? `@${a.username}` : a.displayName}
                    </span>
                  </span>
                  <span className={`grid size-5 place-items-center rounded-full border ${on ? "border-bone bg-bone text-ink" : "border-line"}`}>
                    {on && <DrawCheck className="size-3" />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. When */}
      <section data-reveal className="card glow-card p-6 sm:p-7">
        <Step n={4} title="When" />
        <div className="mt-5 grid grid-cols-3 gap-1 rounded-full border border-line bg-elevated/60 p-1 text-sm">
          {(["now", "schedule", "draft"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`rounded-full py-2 transition duration-300 ${mode === m ? "bg-bone text-ink" : "text-mute hover:text-bone"}`}
            >
              {m === "now" ? "Post now" : m === "schedule" ? "Schedule" : "Draft"}
            </button>
          ))}
        </div>
        {mode === "schedule" && (
          <div className="enter mt-4">
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="input rounded-xl [color-scheme:dark]"
            />
            <p className="mt-2 text-xs text-mute">Your time zone: {tz}</p>
          </div>
        )}
        {mode === "draft" && (
          <p className="enter mt-4 text-xs leading-5 text-mute">Saved in Zernio as a draft; nothing is published.</p>
        )}

        {hasTikTok && mode !== "draft" && (
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-xs leading-5 text-mute">
            <input type="checkbox" checked={tiktokOk} onChange={(e) => setTiktokOk(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-accent)]" />
            <span>
              I&apos;ve previewed the video and consent to posting it publicly on TikTok, and I agree to TikTok&apos;s{" "}
              <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noopener noreferrer" className="text-bone underline underline-offset-2">
                Music Usage Confirmation
              </a>
              .
            </span>
          </label>
        )}

        <div className="mt-6">
          {busy && (
            <div className="enter mb-4">
              <div className="mb-2 flex justify-between text-xs text-mute">
                <span>{phase === "uploading" ? "Uploading video…" : "Publishing…"}</span>
                {phase === "uploading" && <span>{Math.round(progress * 100)}%</span>}
              </div>
              <ProgressBar value={phase === "uploading" ? progress * 100 : 100} />
            </div>
          )}
          <button onClick={submit} disabled={busy} className="btn-primary w-full">
            {busy
              ? "Working…"
              : mode === "now"
                ? `Post to ${chosen.length || ""} ${chosen.length === 1 ? "account" : "accounts"}`
                : mode === "schedule"
                  ? "Schedule post"
                  : "Save draft"}{" "}
            {!busy && <Arrow />}
          </button>
          {(error || problems.length > 0) && (
            <p role="alert" className="mt-3 text-center text-xs text-bad">
              {error ?? problems[0]}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="flex items-center gap-3">
      <span className="grid size-7 place-items-center rounded-full border border-line text-xs text-mute">{n}</span>
      <span className="display text-2xl">{title}</span>
    </h2>
  );
}

function accountName(p: PlatformResult) {
  const a = p.accountId;
  return typeof a === "object" && a ? a.username || a.displayName || "" : "";
}

function StatusChip({ p }: { p: PlatformResult }) {
  const s = p.status ?? "pending";
  const tone = s === "published" ? "border-good/50 text-good" : s === "failed" ? "border-bad/50 text-bad" : "border-line text-mute";
  const inner = (
    <>
      {label(p.platform ?? "")} · {s}
      {p.platformPostUrl ? " ↗" : ""}
    </>
  );
  return p.platformPostUrl ? (
    <a href={p.platformPostUrl} target="_blank" rel="noopener noreferrer" title={accountName(p)} className={`rounded-full border px-3 py-1 text-[11px] transition hover:bg-elevated ${tone}`}>
      {inner}
    </a>
  ) : (
    <span title={p.errorMessage || accountName(p)} className={`rounded-full border px-3 py-1 text-[11px] ${tone}`}>
      {inner}
    </span>
  );
}

function Result({ result, mode, onNew }: { result: { post?: SocialPost; partial?: boolean; warnings?: string[] }; mode: Mode; onNew: () => void }) {
  const post = result.post;
  const failed = post?.platforms?.filter((p) => p.status === "failed") ?? [];
  const heading =
    mode === "draft" ? "Draft saved." : mode === "schedule" ? "Scheduled." : result.partial || failed.length ? "Posted, with issues." : "Posted everywhere.";
  return (
    <section className="enter card glow-card mt-12 p-8 text-center sm:p-10">
      <span className={`mx-auto grid size-14 place-items-center rounded-full border ${failed.length ? "border-bad/50 text-bad" : "border-good/50 text-good"}`}>
        <DrawCheck className="size-7" />
      </span>
      <h2 className="display mt-6 text-4xl">{heading}</h2>
      {mode === "schedule" && post?.scheduledFor && <p className="mt-3 text-sm text-mute">Goes live {fmtDate(post.scheduledFor)}.</p>}
      {post?.platforms?.length ? (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {post.platforms.map((p, i) => (
            <StatusChip key={i} p={p} />
          ))}
        </div>
      ) : null}
      {failed.map((p, i) => (
        <p key={i} className="mt-3 text-xs text-bad">
          {label(p.platform ?? "")}: {p.errorMessage ?? "failed"}
        </p>
      ))}
      {result.warnings?.map((w, i) => (
        <p key={i} className="mt-2 text-xs text-mute">
          {w}
        </p>
      ))}
      <button onClick={onNew} className="btn-primary mt-8">
        New post <Arrow />
      </button>
    </section>
  );
}

function History({ state }: { state: { data?: SocialPost[]; error?: string; loading: boolean; reload: () => void } }) {
  const [retrying, setRetrying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (state.error) return null;
  const posts = state.data ?? [];

  async function retry(id: string) {
    setRetrying(id);
    setError(null);
    try {
      await retryPost(id);
      state.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRetrying(null);
    }
  }

  return (
    <section className="mt-20">
      <div data-reveal className="mb-6 flex items-baseline justify-between border-b border-line pb-4">
        <h2 className="display text-3xl">Recent posts</h2>
        <button onClick={state.reload} className="text-xs text-mute transition hover:text-bone">
          Refresh
        </button>
      </div>
      {error && <p className="mb-4 text-sm text-bad">{error}</p>}
      {state.loading && !posts.length ? (
        <Loading />
      ) : posts.length === 0 ? (
        <p data-reveal className="text-sm text-mute">
          Nothing posted yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => (
            <li key={p._id} data-reveal className="card glow-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm">{p.content || <span className="text-mute">(no caption)</span>}</p>
                <p className="mt-1 text-xs text-mute">
                  {p.status ?? ""} · {p.status === "scheduled" ? `for ${fmtDate(p.scheduledFor)}` : fmtDate(p.createdAt)}
                  {p.mediaItems?.length ? " · with media" : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.platforms?.map((pl, i) => (
                    <StatusChip key={i} p={pl} />
                  ))}
                </div>
              </div>
              {(p.status === "failed" || p.status === "partial") && p._id && (
                <button onClick={() => retry(p._id!)} disabled={retrying === p._id} className="btn-ghost shrink-0 px-4 py-2 text-xs">
                  {retrying === p._id ? "Retrying…" : "Retry failed"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
