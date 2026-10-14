import {
  actualizarPerfilRepo,
  actualizarUsuarioAuthRepo,
  contarAdminsRepo,
  crearUsuarioAuthRepo,
  eliminarUsuarioAuthRepo,
  listarPerfilesRepo,
  obtenerPerfilRepo,
  upsertPerfilAdminRepo,
} from "./repository";
import {
  errorResult,
  esErrorNoEncontrado,
  fromPostgresError,
  okResult,
  type ActionResult,
} from "@/lib/result";
import type { ActualizarPerfilInput, CrearUsuarioInput, Perfil } from "./schemas";

function esCorreoEnUso(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: string; message?: string };
  if (code === "email_exists" || code === "user_already_exists") return true;
  return /already been registered|already registered|already exists/i.test(message ?? "");
}

export async function crearUsuarioService(
  input: CrearUsuarioInput
): Promise<ActionResult<Perfil>> {
  try {
    const { id } = await crearUsuarioAuthRepo({
      email: input.correo,
      password: input.password,
    });
    const perfil = await upsertPerfilAdminRepo({
      id,
      nombre: input.nombre,
      correo: input.correo,
      rol: input.rol,
    });
    return okResult(perfil);
  } catch (error) {
    if (esCorreoEnUso(error)) {
      return errorResult("EMAIL_EN_USO", "Ese correo ya está registrado.");
    }
    return fromPostgresError(error);
  }
}

export async function actualizarMiPerfilService(
  userId: string,
  input: ActualizarPerfilInput
): Promise<ActionResult<Perfil>> {
  try {
    const perfil = await actualizarPerfilRepo({
      id: userId,
      nombre: input.nombre,
      ...(input.correo ? { correo: input.correo } : {}),
    });

    if (input.correo || input.password) {
      await actualizarUsuarioAuthRepo({
        ...(input.correo ? { email: input.correo } : {}),
        ...(input.password ? { password: input.password } : {}),
      });
    }

    return okResult(perfil);
  } catch (error) {
    if (esCorreoEnUso(error)) {
      return errorResult("EMAIL_EN_USO", "Ese correo ya está registrado.");
    }
    return fromPostgresError(error);
  }
}

export async function listarUsuariosService(): Promise<ActionResult<Perfil[]>> {
  try {
    const perfiles = await listarPerfilesRepo();
    return okResult(perfiles);
  } catch (error) {
    return fromPostgresError(error);
  }
}

/** Elimina un usuario con las guardas: no a sí mismo y no al último admin. */
export async function eliminarUsuarioService(
  usuarioActualId: string,
  usuarioId: string
): Promise<ActionResult<null>> {
  if (usuarioActualId === usuarioId) {
    return errorResult("USUARIO_PROPIO", "No puedes eliminar tu propio usuario.");
  }

  try {
    const perfil = await obtenerPerfilRepo(usuarioId);
    if (perfil.rol === "admin") {
      const admins = await contarAdminsRepo();
      if (admins <= 1) {
        return errorResult(
          "ULTIMO_ADMIN",
          "No se puede eliminar al último administrador del sistema."
        );
      }
    }

    await eliminarUsuarioAuthRepo(usuarioId);
    return okResult(null);
  } catch (error) {
    if (esErrorNoEncontrado(error)) {
      return errorResult("NO_ENCONTRADO", "El usuario no existe.");
    }
    return fromPostgresError(error);
  }
}
