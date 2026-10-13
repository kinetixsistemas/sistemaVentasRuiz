import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TAG_EMPRESA } from "@/lib/tags";
import type { Database } from "@/types/database";
import type { ActualizarEmpresaInput, Empresa, EmpresaBranding } from "./schemas";

type EmpresaFila = Database["public"]["Tables"]["empresa"]["Row"];

const COLUMNAS =
  "id, nombre_comercial, razon_social, rif, telefono, correo, direccion, logo_url, stock_bajo_umbral";

/** Columnas expuestas a `anon` para la marca en la pantalla de login (ver migración 0010). */
const COLUMNAS_MARCA = "nombre_comercial, razon_social, logo_url";

type EmpresaSeleccion = Pick<
  EmpresaFila,
  | "id"
  | "nombre_comercial"
  | "razon_social"
  | "rif"
  | "telefono"
  | "correo"
  | "direccion"
  | "logo_url"
  | "stock_bajo_umbral"
>;

function mapearEmpresa(fila: EmpresaSeleccion): Empresa {
  return {
    id: fila.id,
    nombre_comercial: fila.nombre_comercial,
    razon_social: fila.razon_social,
    rif: fila.rif,
    telefono: fila.telefono,
    correo: fila.correo,
    direccion: fila.direccion,
    logo_url: fila.logo_url,
    stock_bajo_umbral: fila.stock_bajo_umbral,
  };
}

export async function obtenerEmpresaRepo(): Promise<Empresa | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("empresa")
    .select(COLUMNAS)
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapearEmpresa(data) : null;
}

/**
 * Marca de la empresa legible sin sesión (nombre, razón social y logotipo),
 * cacheada entre peticiones.
 *
 * La RLS (migración 0010) solo expone esas columnas a `anon`, por lo que se usa
 * un cliente anónimo sin cookies: `unstable_cache` no puede leer datos
 * dinámicos de la petición (cookies). No son datos financieros ni de stock, así
 * que cachearlos es seguro. Se revalidan con `updateTag(TAG_EMPRESA)` al
 * guardar el perfil o el logotipo.
 */
const obtenerEmpresaBrandingCache = unstable_cache(
  async (): Promise<EmpresaBranding | null> => {
    const { url, key } = getSupabaseEnv();
    const supabase = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("empresa")
      .select(COLUMNAS_MARCA)
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  },
  ["empresa-branding"],
  { tags: [TAG_EMPRESA], revalidate: 3600 }
);

export async function obtenerEmpresaBrandingRepo(): Promise<EmpresaBranding | null> {
  return obtenerEmpresaBrandingCache();
}

export async function actualizarEmpresaRepo(input: ActualizarEmpresaInput): Promise<Empresa> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("empresa")
    .upsert(
      {
        id: 1,
        nombre_comercial: input.nombre_comercial,
        razon_social: input.razon_social ?? null,
        rif: input.rif ?? null,
        telefono: input.telefono ?? null,
        correo: input.correo ?? null,
        direccion: input.direccion ?? null,
        stock_bajo_umbral: input.stock_bajo_umbral,
      },
      { onConflict: "id" }
    )
    .select(COLUMNAS)
    .single();
  if (error) throw error;
  return mapearEmpresa(data);
}

/** Actualiza únicamente la URL del logotipo de la empresa. */
export async function actualizarLogoEmpresaRepo(logoUrl: string): Promise<Empresa> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("empresa")
    .update({ logo_url: logoUrl })
    .eq("id", 1)
    .select(COLUMNAS)
    .single();
  if (error) throw error;
  return mapearEmpresa(data);
}

export async function subirLogoRepo(
  nombreArchivo: string,
  archivo: Blob,
  contentType: string
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from("empresa").upload(nombreArchivo, archivo, {
    cacheControl: "31536000",
    contentType,
    upsert: false,
  });
  if (error) throw error;
  return data.path;
}

export async function eliminarLogoRepo(path: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage.from("empresa").remove([path]);
  if (error) throw error;
}

/** URL pública del bucket `empresa` (sin llamar al servidor). */
export function obtenerLogoPublicUrlRepo(path: string): string {
  const { url } = getSupabaseEnv();
  return `${url}/storage/v1/object/public/empresa/${encodeURIComponent(path)}`;
}
