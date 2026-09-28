"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearCache, loadMe, type Me } from "@/lib/network";
import { isConfigured, supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/hooks";
import { ErrorState, Loading } from "@/components/States";

const GuestContext = createContext<{ me: Me; setMe: (me: Me) => void } | null>(null);

function useGuestContext() {
  const ctx = useContext(GuestContext);
  if (!ctx) throw new Error("useMe must be used inside <GuestGate>");
  return ctx;
}

/** The signed-in guest. */
export function useMe() {
  return useGuestContext().me;
}

/** Updates the signed-in guest everywhere on the page (after they edit their profile). */
export function useSetMe() {
  return useGuestContext().setMe;
}

/** Only renders children for a signed-in guest on the guest list; otherwise redirects. */
export function GuestGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured) return setError("The site isn't connected to Supabase yet. Add the Supabase settings and redeploy.");
    let cancelled = false;
    loadMe()
      .then((result) => {
        if (cancelled) return;
        if (result === "signed_out") {
          router.replace(`/?next=${encodeURIComponent(pathname + window.location.search)}`);
        } else if (result === "not_on_list") {
          router.replace("/no-access/");
        } else {
          setMe(result);
        }
      })
      .catch((e: unknown) => !cancelled && setError(errorMessage(e)));

    const { data } = supabase().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearCache();
        router.replace("/");
      }
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
    // Only on mount: the gate wraps every guest page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!me) return <Loading />;
  return <GuestContext.Provider value={{ me, setMe }}>{children}</GuestContext.Provider>;
}
