import type { Metadata } from "next";
import { Fraunces, Geist } from "next/font/google";
import "./globals.css";

// Heavy high-contrast serif for headlines, a wide-tracked sans for everything else — as on obclub.co.
const serif = Fraunces({ subsets: ["latin"], axes: ["SOFT", "WONK", "opsz"], variable: "--font-serif" });
const sans = Geist({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://partner.obclub.co"),
  title: { default: "OBC Partners", template: "%s · OBC Partners" },
  description: "The OB Club Partnership Program — learn sales, business building and personal branding.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
