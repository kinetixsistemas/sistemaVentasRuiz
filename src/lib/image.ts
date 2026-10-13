/**
 * Comprime una imagen en el navegador a WebP antes de subirla a Storage.
 * Reutilizable para logo de empresa y fotos de productos.
 */
export async function comprimirImagen(
  archivo: File,
  opciones: { maxLado?: number; calidad?: number; nombre?: string } = {}
): Promise<File> {
  const { maxLado = 512, calidad = 0.85 } = opciones;
  if (typeof createImageBitmap !== "function") return archivo;
  try {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return archivo;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolver) =>
      canvas.toBlob(resolver, "image/webp", calidad)
    );
    if (!blob) return archivo;
    return new File([blob], opciones.nombre ?? "imagen.webp", { type: "image/webp" });
  } catch {
    return archivo;
  }
}