import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Las fotos llegan ya comprimidas desde el front (~100-150 KB).
  // Se limita el cuerpo de las Server Actions a 2 MB para evitar payloads abusivos.
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  // Las fotos se sirven desde Supabase Storage y ya vienen optimizadas,
  // por lo que no se usa el optimizador de imágenes de Vercel.
  images: {
    unoptimized: true,
  },
  // Caché HTTP de assets estáticos: evita revalidar en cada carga. Los iconos
  // son inmutables; el logo y el manifest cambian poco, así que se cachean
  // por un tiempo acotado para permitir actualizaciones.
  async headers() {
    return [
      {
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/icon.svg",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
      {
        source: "/kinetixLogo.webp",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ];
  },
};

export default nextConfig;
