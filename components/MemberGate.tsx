"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { loadMember, type Member } from "@/lib/data";
import { isConfigured, supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/hooks";
import { ErrorState, Loading } from "@/components/States";

const MemberContext = createContext<Member | null>(null);

export function useMember() {
  const member = useContext(MemberContext);
  if (!member) throw new Error("useMember must be used inside <MemberGate>");
  return member;
}

/** Only renders children for a signed-in, allowlisted member; otherwise redirects. */
export function MemberGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [member, setMember] = useState<Member | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured) return setError("The site isn't connected to Supabase yet. Add the Supabase settings and redeploy.");
    let cancelled = false;
    loadMember()
      .then((result) => {
        if (cancelled) return;
        if (result === "signed_out") {
          router.replace(`/?next=${encodeURIComponent(pathname + window.location.search)}`);
        } else if (result === "not_allowed") {
          router.replace("/no-access/");
        } else {
          setMember(result);
        }
      })
      .catch((e: unknown) => !cancelled && setError(errorMessage(e)));

    const { data } = supabase().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/");
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
    // Only on mount: the gate wraps every member page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!member) return <Loading />;
  return <MemberContext.Provider value={member}>{children}</MemberContext.Provider>;
}
