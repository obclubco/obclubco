"use client";

import { AppHeader } from "@/components/AppHeader";
import { Footer } from "@/components/Footer";
import { MemberGate } from "@/components/MemberGate";
import { Starfield } from "@/components/Starfield";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MemberGate>
      <div className="grain relative isolate flex min-h-dvh flex-col">
        <Starfield density={0.6} />
        <AppHeader />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </MemberGate>
  );
}
