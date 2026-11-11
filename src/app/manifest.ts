
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "BillSwipe",
    short_name: "BillSwipe",
    description: "Discover community sponsorship opportunities.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#090810",
    theme_color: "#090810",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
      },
      {
        src: "/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
      },
    ],
  };
}
