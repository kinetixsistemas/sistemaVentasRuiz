import {
  actualizarEmpresaRepo,
  actualizarLogoEmpresaRepo,
  eliminarLogoRepo,
  obtenerEmpresaBrandingRepo,
  obtenerEmpresaRepo,
  obtenerLogoPublicUrlRepo,
  subirLogoRepo,
} from "./repository";
import {
  errorResult,
  fromPostgresError,
  okResult,
  type ActionResult,
} from "@/lib/result";
import type { ActualizarEmpresaInput, Empresa, EmpresaBranding } from "./schemas";

const EMPRESA_POR_DEFECTO: Empresa = {
  id: 1,
  nombre_comercial: "Sistemas Kinetix",
  razon_social: null,
  rif: null,
  telefono: null,
  correo: null,
  direccion: null,
  logo_url: null,
  stock_bajo_umbral: 5,
};

const BRANDING_POR_DEFECTO: EmpresaBranding = {
  nombre_comercial: "Sistemas Kinetix",
  razon_social: null,
  logo_url: null,
};

export async function obtenerEmpresaService(): Promise<ActionResult<Empresa>> {
  try {
    const empresa = await obtenerEmpresaRepo();
    return okResult(empresa ?? EMPRESA_POR_DEFECTO);
  } catch (error) {
    return fromPostgresError(error);
  }
}

/** Marca para envoltorios de UI (shell/login). Nunca lanza: cae al valor por defecto. */
export async function obtenerEmpresaBrandingService(): Promise<EmpresaBranding> {
  try {
    const branding = await obtenerEmpresaBrandingRepo();
    return branding ?? BRANDING_POR_DEFECTO;
  } catch {
    return BRANDING_POR_DEFECTO;
  }
}

export async function actualizarEmpresaService(
  input: ActualizarEmpresaInput
): Promise<ActionResult<Empresa>> {
  try {
    const empresa = await actualizarEmpresaRepo(input);
    return okResult(empresa);
  } catch (error) {
    return fromPostgresError(error);
  }
}

const FORMATOS_PERMITIDOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// El logotipo llega comprimido desde el front; se acepta hasta 1 MB.
const TAMANO_MAXIMO = 1024 * 1024;

function pathDeUrlPublica(url: string): string | null {
  const marcador = "/storage/v1/object/public/empresa/";
  const indice = url.indexOf(marcador);
  if (indice === -1) return null;
  return url.slice(indice + marcador.length).split("?")[0] ?? null;
}

export async function subirLogoEmpresaService({
  archivo,
}: {
  archivo: File;
}): Promise<ActionResult<Empresa>> {
  const extension = FORMATOS_PERMITIDOS[archivo.type];
  if (!extension) {
    return errorResult("LOGO_INVALIDO", "Formato no permitido. Use JPEG, PNG o WebP.");
  }
  if (archivo.size <= 0 || archivo.size > TAMANO_MAXIMO) {
    return errorResult("LOGO_INVALIDO", "La imagen debe pesar como máximo 1 MB.");
  }

  const empresaRes = await obtenerEmpresaService();
  if (!empresaRes.ok) return empresaRes;
  const logoAnterior = empresaRes.data.logo_url;

  const nombreArchivo = `logo-${Date.now()}.${extension}`;

  try {
    await subirLogoRepo(nombreArchivo, archivo, archivo.type);
    const logoUrl = obtenerLogoPublicUrlRepo(nombreArchivo);
    const empresa = await actualizarLogoEmpresaRepo(logoUrl);

    // Al reemplazar se sube un archivo nuevo y se elimina el anterior.
    const pathAnterior = logoAnterior ? pathDeUrlPublica(logoAnterior) : null;
    if (pathAnterior && pathAnterior !== nombreArchivo) {
      try {
        await eliminarLogoRepo(pathAnterior);
      } catch {
        // El logo anterior no debe bloquear la actualización.
      }
    }

    return okResult(empresa);
  } catch (error) {
    return fromPostgresError(error);
  }
}
