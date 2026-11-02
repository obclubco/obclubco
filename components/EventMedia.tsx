"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Close, Download, Play, Plus } from "@/components/Icons";
import { errorMessage } from "@/lib/hooks";
import {
  addEventMedia,
  deleteEventMedia,
  downloadLink,
  duration,
  getEventMedia,
  mediaLinks,
  type EventMedia as Media,
} from "@/lib/media";
import type { NetEvent } from "@/lib/network";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** How many show before More: one row. */
const PREVIEW = 3;
const label = (m: Media, i: number, total: number) => `${m.kind === "video" ? "Video" : "Photo"} ${i + 1} of ${total}`;

/** An event's photos and videos: a grid that opens full screen. Admins add and delete them. */
export function EventMedia({ event, isAdmin }: { event: NetEvent; isAdmin: boolean }) {
  // undefined: loading; null: not set up in Supabase yet (0010_event_media.sql).
  const [items, setItems] = useState<Media[] | null | undefined>(undefined);
  const [links, setLinks] = useState<Map<string, string>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [report, setReport] = useState<{ photos: number; videos: number; problems: string[] } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const section = useRef<HTMLElement>(null);

  const addLinks = useCallback(async (list: Media[]) => {
    const map = await mediaLinks(list.flatMap((m) => [m.path, ...(m.thumb_path ? [m.thumb_path] : [])]));
    setLinks((prev) => new Map([...prev, ...map]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    getEventMedia(event.id)
      .then(async (list) => {
        if (cancelled) return;
        setItems(list);
        if (list?.length) await addLinks(list);
      })
      .catch((e) => !cancelled && setLoadError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [event.id, addLinks]);

  async function add(files: File[]) {
    if (!files.length) return;
    setReport(null);
    const result = { photos: 0, videos: 0, problems: [] as string[] };
    for (const [i, file] of files.entries()) {
      setProgress({ done: i, total: files.length });
      try {
        const m = await addEventMedia(event.id, file);
        result[m.kind === "video" ? "videos" : "photos"]++;
        setItems((prev) => [...(prev ?? []), m]);
        // Show everything, so each one appears as it's added.
        setExpanded(true);
        await addLinks([m]);
      } catch (e) {
        const message = errorMessage(e);
        result.problems.push(message.includes(file.name) ? message : `${file.name}: ${message}`);
      }
    }
    setProgress(null);
    setReport(result);
  }

  function toggle() {
    if (!expanded) return setExpanded(true);
    setExpanded(false);
    // Back up to the photos if the page is now scrolled past them.
    requestAnimationFrame(() => {
      if ((section.current?.getBoundingClientRect().top ?? 0) < 0) section.current?.scrollIntoView({ behavior: "smooth" });
    });
  }

  function deleted(m: Media) {
    const rest = (items ?? []).filter((x) => x.id !== m.id);
    setItems(rest);
    setOpen((i) => (i === null || rest.length === 0 ? null : Math.min(i, rest.length - 1)));
  }

  if (loadError) {
    return isAdmin ? <p className="card mt-16 p-6 text-sm text-bad">Couldn&apos;t load the photos and videos: {loadError}</p> : null;
  }
  if (items === undefined || (!isAdmin && !items?.length)) return null;

  return (
    <section ref={section} className="mt-16 scroll-mt-28" aria-labelledby="media-title">
      <div data-reveal className="flex flex-col gap-5 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="media-title" className="display text-4xl">
          Photos &amp; Videos {!!items?.length && <span className="text-mute">{items.length}</span>}
        </h2>
        {isAdmin && items && (
          <label
            className={`btn-ghost gap-2 px-5 py-2.5 text-xs ${progress ? "pointer-events-none opacity-70" : "cursor-pointer"}`}
          >
            <Plus className="size-3.5" />
            {progress ? `Adding ${progress.done + 1} of ${progress.total}…` : "Add photos and videos"}
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              className="sr-only"
              disabled={!!progress}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                add(files);
              }}
            />
          </label>
        )}
      </div>

      {items === null && (
        <p className="card mt-6 p-6 text-sm leading-6 text-mute">
          Photos and videos aren&apos;t set up in Supabase yet: run{" "}
          <code className="text-bone">supabase/migrations/0010_event_media.sql</code> in its SQL Editor, then reload this
          page.
        </p>
      )}

      {report && (
        <div role={report.problems.length ? "alert" : "status"} className="enter card mt-6 space-y-1 px-5 py-4 text-sm">
          {report.photos + report.videos > 0 && (
            <p className="text-good">
              Added{" "}
              {[report.photos && plural(report.photos, "photo"), report.videos && plural(report.videos, "video")]
                .filter(Boolean)
                .join(" and ")}
              .
            </p>
          )}
          {report.problems.map((p) => (
            <p key={p} className="text-bad">
              {p}
            </p>
          ))}
        </div>
      )}

      {items?.length === 0 && (
        <p className="mt-6 max-w-2xl text-sm leading-6 text-mute">
          No photos or videos yet. Everyone on this event&apos;s guest list sees what you add here. Photos are resized for
          the web; videos can be up to 50 MB each, and MP4 plays everywhere.
        </p>
      )}

      {!!items?.length && (
        <ul className="mt-6 grid grid-cols-3 gap-1.5 sm:gap-3">
          {(expanded ? items : items.slice(0, PREVIEW)).map((m, i) => {
            const preview = links.get(m.thumb_path ?? (m.kind === "photo" ? m.path : ""));
            return (
              <li
                key={m.id}
                // The ones More shows fade in, one after another.
                className={i >= PREVIEW ? "enter" : undefined}
                style={i >= PREVIEW ? ({ "--d": `${Math.min(i - PREVIEW, 11) * 40}ms` } as React.CSSProperties) : undefined}
              >
                <button
                  type="button"
                  onClick={() => setOpen(i)}
                  aria-label={label(m, i, items.length)}
                  className="group relative block aspect-square w-full overflow-hidden rounded-xl border border-line bg-elevated"
                >
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={preview}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover transition duration-500 ease-smooth group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span className="grid size-full place-items-center text-mute">
                      <Play className="size-6" />
                    </span>
                  )}
                  {m.kind === "video" && (
                    <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-ink/75 px-2 py-0.5 text-[11px] text-bone backdrop-blur sm:bottom-2 sm:left-2 sm:px-2.5 sm:py-1">
                      <Play className="size-3" /> {duration(m.seconds) ?? "Video"}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!!items && items.length > PREVIEW && (
        <div className="mt-5 flex justify-center">
          <button type="button" onClick={toggle} aria-expanded={expanded} className="btn-ghost gap-2 px-6 py-2.5 text-xs">
            {expanded ? (
              "Less"
            ) : (
              <>
                More <span className="text-mute">+{items.length - PREVIEW}</span>
              </>
            )}
            <ChevronDown className={`size-3.5 transition duration-300 ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      )}

      {open !== null && items?.[open] && (
        <Viewer
          items={items}
          index={open}
          links={links}
          title={event.title}
          isAdmin={isAdmin}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          onDeleted={deleted}
        />
      )}
    </section>
  );
}

/** Full screen: one photo or video at a time, with arrows (or swipe), Download, and Delete for admins. */
function Viewer({
  items,
  index,
  links,
  title,
  isAdmin,
  onIndex,
  onClose,
  onDeleted,
}: {
  items: Media[];
  index: number;
  links: Map<string, string>;
  title: string;
  isAdmin: boolean;
  onIndex: (i: number) => void;
  onClose: () => void;
  onDeleted: (m: Media) => void;
}) {
  const m = items[index];
  const ref = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ index: number; text: string } | null>(null);
  const go = useCallback((step: number) => onIndex((index + step + items.length) % items.length), [index, items.length, onIndex]);

  // While open: no scrolling behind it, focus inside it, and back to where you were afterwards.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && items.length > 1) go(1);
      else if (e.key === "ArrowLeft" && items.length > 1) go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, items.length]);

  async function download() {
    setMessage(null);
    try {
      window.location.assign(await downloadLink(m, `${title} ${index + 1}.${m.path.split(".").pop()}`));
    } catch (e) {
      setMessage({ index, text: `Couldn't download it: ${errorMessage(e)}` });
    }
  }

  async function remove() {
    if (!window.confirm(`Delete this ${m.kind}? It's removed for everyone.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await deleteEventMedia(m);
      onDeleted(m);
    } catch (e) {
      setMessage({ index, text: `Couldn't delete it: ${errorMessage(e)}` });
    } finally {
      setBusy(false);
    }
  }

  const src = links.get(m.path);
  const poster = m.thumb_path ? links.get(m.thumb_path) : undefined;
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label(m, index, items.length)}
      tabIndex={-1}
      className="fixed inset-0 z-[90] flex flex-col bg-ink/95 outline-none backdrop-blur-sm"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50 && items.length > 1) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <p className="text-xs uppercase tracking-widest text-mute">
          {index + 1} / {items.length}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={download} className="btn-ghost gap-1.5 px-4 py-2 text-xs">
            <Download className="size-3.5" /> Download
          </button>
          {isAdmin && (
            <button type="button" onClick={remove} disabled={busy} className="btn-ghost px-4 py-2 text-xs">
              {busy ? "Deleting…" : "Delete"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 place-items-center rounded-full border border-line text-bone/80 transition hover:text-bone"
          >
            <Close />
          </button>
        </div>
      </div>
      {message?.index === index && (
        <p role="alert" className="px-4 text-sm text-bad sm:px-6">
          {message.text}
        </p>
      )}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6 sm:px-16">
        {!src ? (
          <span className="spinner" role="status" aria-label="Loading" />
        ) : m.kind === "photo" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={m.id} src={src} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        ) : (
          <video key={m.id} src={src} poster={poster} controls playsInline autoPlay className="max-h-full max-w-full rounded-lg" />
        )}
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous"
              className="absolute left-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-line bg-ink/60 text-bone/80 transition hover:text-bone sm:left-4"
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next"
              className="absolute right-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-line bg-ink/60 text-bone/80 transition hover:text-bone sm:right-4"
            >
              <ChevronRight />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
