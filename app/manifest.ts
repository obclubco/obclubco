import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// Lets partners install the site as an app (home screen / dock), opening full-screen like a native app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "OBC Partners",
    short_name: "OBC Partners",
    description: "The OB Club Partnership Program — learn sales, business building and personal branding.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#060606",
    theme_color: "#060606",
    categories: ["education", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My courses", url: "/dashboard/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Coaches", url: "/coaches/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
