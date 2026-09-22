"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function SignOutButton({ className }: { className: string }) {
  const router = useRouter();
  return (
    <button
      className={className}
      onClick={async () => {
        await supabase().auth.signOut();
        router.replace("/");
      }}
    >
      Sign out
    </button>
  );
}
