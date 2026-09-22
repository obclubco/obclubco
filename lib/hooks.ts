"use client";

import { useCallback, useEffect, useState } from "react";

/** Runs an async loader and tracks loading / error state. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    load()
      .then((data) => !cancelled && setState({ data, loading: false }))
      .catch((e: unknown) => !cancelled && setState({ error: errorMessage(e), loading: false }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = `${title} · OBC Partners`;
  }, [title]);
}

/** Supabase errors are plain objects with a `message`, not Error instances. */
export function errorMessage(e: unknown) {
  if (e && typeof e === "object" && "message" in e && typeof e.message === "string") return e.message;
  return String(e);
}
