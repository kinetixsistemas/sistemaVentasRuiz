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
};

export default nextConfig;
