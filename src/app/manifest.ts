import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sistemas Kinetix · Gestión Comercial",
    short_name: "Sistemas Kinetix",
    description: "Sistema de inventario, ventas y cobranza para pequeños negocios.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "es",
    background_color: "#f5f5f7",
    theme_color: "#f5f5f7",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}