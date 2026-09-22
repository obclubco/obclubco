"use client";

import { AppHeader } from "@/components/AppHeader";
import { Footer } from "@/components/Footer";
import { MemberGate } from "@/components/MemberGate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MemberGate>
      <div className="flex min-h-dvh flex-col">
        <AppHeader />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </MemberGate>
  );
}
