"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * "Install app" button. Chrome/Edge/Android: opens the browser's install dialog.
 * iPhone/iPad (no install dialog on iOS): shows the Share → Add to Home Screen steps.
 * Hidden once installed, and in browsers that can't install apps.
 * On phones it floats at the bottom of the screen (dismissible); on larger screens it sits in the header.
 */
const DISMISS_KEY = "obc-install-dismissed";
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [help, setHelp] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIos());
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!prompt && !ios)) return null;

  async function install() {
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setPrompt(null);
    } else {
      setHelp(true);
    }
  }

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }

  const icon = (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" />
    </svg>
  );

  return (
    <>
      {/* Larger screens: in the header */}
      <button onClick={install} className="btn-ghost hidden gap-2 px-4 py-2.5 text-[13px] sm:inline-flex">
        {icon} Install app
      </button>

      {/* Phones: floating pill at the bottom, drawn outside the header, plus the iOS help sheet */}
      {createPortal(
        <>
          {!dismissed && !help && (
            <div className="enter fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4 sm:hidden" style={{ "--d": "2600ms" } as React.CSSProperties}>
              <div className="flex items-center gap-1 rounded-full border border-line bg-ink/85 p-1.5 shadow-[0_20px_50px_-15px_rgb(0_0_0/0.9)] backdrop-blur-md">
                <button onClick={install} className="btn-primary gap-2 px-5 py-2.5 text-[13px]">
                  {icon} Install app
                </button>
                <button onClick={dismiss} aria-label="Hide" className="grid size-9 place-items-center rounded-full text-mute transition hover:text-bone">
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          {help && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center" onClick={() => setHelp(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-title"
            className="enter card w-full max-w-sm bg-surface p-6 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="install-title" className="display text-2xl">
              Install OBC Partners
            </h2>
            <ol className="mt-5 space-y-4 text-sm text-bone/85">
              <li className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-xs">1</span>
                <span className="flex items-center gap-2">
                  Tap
                  <svg viewBox="0 0 24 24" className="size-5 text-bone" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-label="Share">
                    <path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
                  </svg>
                  <b className="font-medium">Share</b> in Safari&apos;s toolbar
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-xs">2</span>
                <span>
                  Choose <b className="font-medium">Add to Home Screen</b>, then <b className="font-medium">Add</b>
                </span>
              </li>
            </ol>
            <button onClick={() => setHelp(false)} className="btn-primary mt-6 w-full">
              Got it
            </button>
          </div>
        </div>
          )}
        </>,
        document.body,
      )}
    </>
  );
}
