"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { Loading } from "@/components/States";
import { supabase } from "@/lib/supabase";

function safeNext(next: string | null) {
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard/";
}

// Where sign-in links land. The Supabase client exchanges `?code=` automatically on load;
// `?token_hash=&type=` links (custom email templates) are verified here.
export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const errorDescription = params.get("error_description") ?? hash.get("error_description");
      const tokenHash = params.get("token_hash");
      const type = params.get("type") as EmailOtpType | null;
      const next = safeNext(params.get("next"));

      if (!errorDescription && tokenHash && type) {
        await supabase().auth.verifyOtp({ token_hash: tokenHash, type });
      }
      const {
        data: { session },
      } = await supabase().auth.getSession();

      if (session) return router.replace(next);
      const reason = /not.?authori|saving new user/i.test(errorDescription ?? "") ? "not_authorized" : "link_invalid";
      router.replace(`/login/?error=${reason}`);
    })();
  }, [router]);

  return (
    <main className="grain grid min-h-dvh place-items-center">
      <Loading />
    </main>
  );
}
