import type { Metadata, Viewport } from "next";
import { Fraunces, Geist } from "next/font/google";
import "./globals.css";
import { Motion } from "@/components/Motion";
import { Pwa } from "@/components/Pwa";

// Heavy high-contrast serif for headlines, a wide-tracked sans for everything else — as on obclub.co.
const serif = Fraunces({ subsets: ["latin"], axes: ["SOFT", "WONK", "opsz"], variable: "--font-serif" });
const sans = Geist({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://networking.obclub.co"),
  title: { default: "OBC Networking", template: "%s · OBC Networking" },
  description: "OB Club networking: your profile, the events you've been to and the guests you met there.",
  applicationName: "OBC Networking",
  // Installed on iPhone/iPad: full-screen, dark status bar, "OBC Network" under the icon.
  appleWebApp: { capable: true, title: "OBC Network", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  // Other sites see only "networking.obclub.co" when someone follows a link from here, never the page or its query.
  referrer: "strict-origin-when-cross-origin",
};

export const viewport: Viewport = {
  themeColor: "#060606",
  colorScheme: "dark",
  // Use the whole screen on phones with a notch; content keeps clear of it with safe-area padding.
  viewportFit: "cover",
};

// Clickjacking: inside another site's frame the page hides itself and tries to take over the whole tab. The
// X-Frame-Options and frame-ancestors headers block framing outright (scripts/security-headers.mjs), but not every
// host can send headers (GitHub Pages can't). Its hash is allowed by the Content-Security-Policy.
const FRAME_GUARD = `if (window.top !== window.self) {
  document.documentElement.style.display = "none";
  try { window.top.location.replace(window.location.href); } catch (e) {}
}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: FRAME_GUARD }} />
      </head>
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
