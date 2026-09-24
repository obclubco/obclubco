import type { Metadata, Viewport } from "next";
import { Fraunces, Geist } from "next/font/google";
import "./globals.css";
import { Motion } from "@/components/Motion";
import { Pwa } from "@/components/Pwa";

// Heavy high-contrast serif for headlines, a wide-tracked sans for everything else — as on obclub.co.
const serif = Fraunces({ subsets: ["latin"], axes: ["SOFT", "WONK", "opsz"], variable: "--font-serif" });
const sans = Geist({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://partner.obclub.co"),
  title: { default: "OBC Partners", template: "%s · OBC Partners" },
  description: "The OB Club Partnership Program — learn sales, business building and personal branding.",
  applicationName: "OBC Partners",
  // Installed on iPhone/iPad: full-screen, dark status bar, "OBC Partners" under the icon.
  appleWebApp: { capable: true, title: "OBC Partners", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#060606",
  colorScheme: "dark",
  // Use the whole screen on phones with a notch; content keeps clear of it with safe-area padding.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>
        {/* Without JavaScript, show everything that would otherwise animate in. */}
        <noscript>
          <style>{"[data-reveal],[data-reveal] .word{opacity:1!important}"}</style>
        </noscript>
        <a
          href="#main"
          className="sr-only fixed left-4 top-4 z-[70] rounded-full bg-accent px-5 py-3 text-sm text-ink focus:not-sr-only"
        >
          Skip to content
        </a>
        <Motion />
        <Pwa />
        {children}
      </body>
    </html>
  );
}
