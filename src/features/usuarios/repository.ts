import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, RolUsuario } from "@/types/database";
import type { Perfil } from "./schemas";

type PerfilFila = Database["public"]["Tables"]["perfiles"]["Row"];

const COLUMNAS = "id, nombre, correo, rol, created_at";

type PerfilSeleccion = Pick<PerfilFila, "id" | "nombre" | "correo" | "rol" | "created_at">;

function mapearPerfil(fila: PerfilSeleccion): Perfil {
  return {
    id: fila.id,
    nombre: fila.nombre,
    correo: fila.correo,
    rol: fila.rol,
    created_at: fila.created_at,
  };
}

export async function listarPerfilesRepo(): Promise<Perfil[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("perfiles")
    .select(COLUMNAS)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapearPerfil);
}

export async function obtenerPerfilRepo(id: string): Promise<Perfil> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("perfiles").select(COLUMNAS).eq("id", id).single();
  if (error) throw error;
  return mapearPerfil(data);
}

/** Actualiza la fila propia del perfil (la RLS exige auth.uid() = id). */
export async function actualizarPerfilRepo(input: {
  id: string;
  nombre: string;
  correo?: string;
}): Promise<Perfil> {
  const supabase = await createSupabaseServerClient();
  const cambios: { nombre: string; correo?: string } = { nombre: input.nombre };
  if (input.correo) cambios.correo = input.correo;

  const { data, error } = await supabase
    .from("perfiles")
    .update(cambios)
    .eq("id", input.id)
    .select(COLUMNAS)
    .single();
  if (error) throw error;
  return mapearPerfil(data);
}

/** Crea el usuario en Supabase Auth (requiere el cliente admin / service_role). */
export async function crearUsuarioAuthRepo(input: {
  email: string;
  password: string;
}): Promise<{ id: string }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });
  if (error) throw error;
  if (!data.user) throw new Error("No se pudo crear el usuario.");
  return { id: data.user.id };
}

/** Inserta o actualiza el perfil con el cliente admin (omite RLS). */
export async function upsertPerfilAdminRepo(input: {
  id: string;
  nombre: string;
  correo: string;
  rol: RolUsuario;
}): Promise<Perfil> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("perfiles")
    .upsert({ ...input }, { onConflict: "id" })
    .select(COLUMNAS)
    .single();
  if (error) throw error;
  return mapearPerfil(data);
}

/** Actualiza el correo y/o contraseña del usuario en sesión (server client). */
export async function actualizarUsuarioAuthRepo(input: {
  email?: string;
  password?: string;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    ...(input.email ? { email: input.email } : {}),
    ...(input.password ? { password: input.password } : {}),
  });
  if (error) throw error;
}
