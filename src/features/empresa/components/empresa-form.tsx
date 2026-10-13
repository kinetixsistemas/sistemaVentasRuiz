"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actualizarEmpresa, subirLogoEmpresa } from "../actions";
import type { Empresa } from "../schemas";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

type CampoEmpresa =
  | "nombre_comercial"
  | "razon_social"
  | "rif"
  | "telefono"
  | "correo"
  | "direccion"
  | "stock_bajo_umbral";

/** Reduce y recomprime la imagen a WebP (máx. 512 px, < 1 MB) antes de subirla. */
async function comprimirLogo(archivo: File): Promise<File> {
  if (typeof createImageBitmap !== "function") return archivo;
  try {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return archivo;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolver) =>
      canvas.toBlob(resolver, "image/webp", 0.85)
    );
    if (!blob) return archivo;
    return new File([blob], "logo.webp", { type: "image/webp" });
  } catch {
    return archivo;
  }
}

export function EmpresaForm({ empresa }: { empresa: Empresa | null }) {
  const toast = useToast();
  const router = useRouter();
  const inputLogo = useRef<HTMLInputElement>(null);

  const [campos, setCampos] = useState({
    nombre_comercial: empresa?.nombre_comercial ?? "",
    razon_social: empresa?.razon_social ?? "",
    rif: empresa?.rif ?? "",
    telefono: empresa?.telefono ?? "",
    correo: empresa?.correo ?? "",
    direccion: empresa?.direccion ?? "",
    stock_bajo_umbral: String(empresa?.stock_bajo_umbral ?? 5),
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [logoUrl, setLogoUrl] = useState<string | null>(empresa?.logo_url ?? null);
  const [guardando, startGuardar] = useTransition();
  const [subiendo, startSubir] = useTransition();

  const set = (campo: CampoEmpresa, valor: string) =>
    setCampos((actual) => ({ ...actual, [campo]: valor }));

  function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrores({});
    startGuardar(async () => {
      const res = await actualizarEmpresa({
        nombre_comercial: campos.nombre_comercial,
        razon_social: campos.razon_social,
        rif: campos.rif,
        telefono: campos.telefono,
        correo: campos.correo,
        direccion: campos.direccion,
        stock_bajo_umbral: Number(campos.stock_bajo_umbral),
      });
      if (res.ok) {
        toast.success("Datos de la empresa guardados");
        router.refresh();
      } else {
        setErrores(res.error.fieldErrors ?? {});
        toast.error(res.error.message);
      }
    });
  }

  function cambiarLogo(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;
    startSubir(async () => {
      const optimizado = await comprimirLogo(archivo);
      const datos = new FormData();
      datos.append("logo", optimizado);
      const res = await subirLogoEmpresa(datos);
      if (res.ok) {
        setLogoUrl(res.data.logo_url);
        toast.success("Logotipo actualizado");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4" noValidate>
      <Card title="Identidad del negocio" subtitle="Aparece en el sistema y en los documentos.">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl bg-surface-container">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logotipo" className="h-full w-full object-contain" />
              ) : (
                <Icon name="storefront" size={36} className="text-on-surface-variant" />
              )}
            </span>
            <input
              ref={inputLogo}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={cambiarLogo}
            />
            <Button
              variant="secondary"
              size="sm"
              icon="upload"
              loading={subiendo}
              onClick={() => inputLogo.current?.click()}
            >
              {logoUrl ? "Cambiar" : "Subir logo"}
            </Button>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Nombre comercial"
              name="nombre_comercial"
              value={campos.nombre_comercial}
              onChange={(e) => set("nombre_comercial", e.target.value)}
              error={errores.nombre_comercial}
              required
            />
            <Input
              label="Razón social"
              name="razon_social"
              value={campos.razon_social}
              onChange={(e) => set("razon_social", e.target.value)}
              error={errores.razon_social}
            />
          </div>
        </div>
      </Card>

      <Card title="Datos fiscales y de contacto">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="RIF"
            name="rif"
            placeholder="J-12345678-9"
            value={campos.rif}
            onChange={(e) => set("rif", e.target.value)}
            error={errores.rif}
            icon="badge"
          />
          <Input
            label="Teléfono"
            name="telefono"
            placeholder="04141234567"
            inputMode="tel"
            value={campos.telefono}
            onChange={(e) => set("telefono", e.target.value)}
            error={errores.telefono}
            icon="call"
          />
          <Input
            label="Correo"
            name="correo"
            type="email"
            inputMode="email"
            value={campos.correo}
            onChange={(e) => set("correo", e.target.value)}
            error={errores.correo}
            icon="mail"
          />
          <Input
            label="Umbral de stock bajo"
            name="stock_bajo_umbral"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={campos.stock_bajo_umbral}
            onChange={(e) => set("stock_bajo_umbral", e.target.value)}
            error={errores.stock_bajo_umbral}
            hint="Se avisa cuando un producto baja de esta cantidad."
          />
          <div className="sm:col-span-2">
            <Textarea
              label="Dirección"
              name="direccion"
              rows={2}
              value={campos.direccion}
              onChange={(e) => set("direccion", e.target.value)}
              error={errores.direccion}
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" icon="save" loading={guardando}>
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
