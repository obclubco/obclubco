"use client";

import { Backdrop } from "@/components/Backdrop";
import { Footer } from "@/components/Footer";
import { GuestGate } from "@/components/GuestGate";
import { NetworkHeader, TabBar } from "@/components/NetworkHeader";

export default function NetworkLayout({ children }: { children: React.ReactNode }) {
  return (
    <GuestGate>
      {/* Bottom padding on phones keeps the footer clear of the tab bar. */}
      <div className="relative isolate flex min-h-dvh flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <Backdrop stars={0.6} />
        <NetworkHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <TabBar />
      </div>
    </GuestGate>
  );
}
