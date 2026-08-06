import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trimos Driver",
    short_name: "Trimos",
    description: "Pedidos e entregas em tempo real.",
    start_url: "/driver/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f4f4f5",
    theme_color: "#18181b",
    orientation: "portrait",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
