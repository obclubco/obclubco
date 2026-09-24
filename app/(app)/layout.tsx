"use client";

import { AppHeader } from "@/components/AppHeader";
import { Footer } from "@/components/Footer";
import { MemberGate } from "@/components/MemberGate";
import { Backdrop } from "@/components/Backdrop";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MemberGate>
      <div className="relative isolate flex min-h-dvh flex-col">
        <Backdrop stars={0.6} />
        <AppHeader />
        <main id="main" className="flex-1">{children}</main>
        <Footer />
      </div>
    </MemberGate>
  );
}
