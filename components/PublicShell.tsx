"use client";

import { Backdrop } from "@/components/Backdrop";
import { Footer } from "@/components/Footer";
import { NavButton, SiteNav } from "@/components/SiteNav";

/** Layout for the public pages (About, Coaches): background, nav with a Log in button, footer. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <Backdrop stars={1.1} />
      <SiteNav cta={<NavButton href="/">Log in</NavButton>} />
      <main id="main" className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
