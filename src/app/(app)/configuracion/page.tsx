import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { obtenerEmpresaService } from "@/features/empresa/service";
import { listarUsuariosService } from "@/features/usuarios/service";

const ConfiguracionTabs = dynamic(() => import("./configuracion-tabs").then((m) => m.ConfiguracionTabs), {
  loading: () => <ListSkeleton rows={4} />,
});

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
