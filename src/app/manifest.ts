import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ÓRBITA",
    short_name: "ÓRBITA",
    description: "Órbita Hub",
    id: "/",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    display_override: ["fullscreen", "standalone"],
    background_color: "#fff",
    theme_color: "#fff",
    icons: [
      {
        src: "/favicon.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/favicon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
