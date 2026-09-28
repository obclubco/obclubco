import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// Lets guests install the site as an app (home screen / dock), opening full-screen like a native app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "OBC Networking",
    short_name: "OBC Network",
    description: "OB Club networking: your profile, the events you've been to and the guests you met there.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#060606",
    theme_color: "#060606",
    categories: ["business", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Guests", url: "/guests/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Events", url: "/events/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My profile", url: "/profile/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
