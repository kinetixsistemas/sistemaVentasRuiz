import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth";
import { obtenerEmpresaService } from "@/features/empresa/service";
import { listarUsuariosService } from "@/features/usuarios/service";
import { ConfiguracionTabs } from "./configuracion-tabs";

export const metadata: Metadata = {
  title: "Configuración",
};

export default async function ConfiguracionPage() {
  const user = await getCurrentUser();

  const [empresaRes, usuariosRes] = await Promise.all([
    obtenerEmpresaService(),
    listarUsuariosService(),
  ]);

  const empresa = empresaRes.ok ? empresaRes.data : null;
  const usuarios = usuariosRes.ok ? usuariosRes.data : [];
  const miPerfil = usuarios.find((u) => u.id === user?.id) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon="settings"
        title="Configuración"
        description="Datos del negocio, tu cuenta y los usuarios del sistema."
      />
      <ConfiguracionTabs
        empresa={empresa}
        usuarios={usuarios}
        miPerfil={miPerfil}
        email={user?.email}
        miId={user?.id ?? ""}
      />
    </div>
  );
}
