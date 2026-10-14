import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { obtenerEmpresaBrandingService } from "@/features/empresa/service";
import { Brand } from "@/components/layout/brand";
import { DesktopNav, BottomNav } from "@/components/layout/app-nav";
import { SidebarFooter } from "@/components/layout/sidebar-footer";
import { UserMenu } from "@/components/layout/user-menu";
import { Icon } from "@/components/ui/icon";
import { logout } from "./actions";

function fechaHoyLarga(): string {
  return new Intl.DateTimeFormat("es-VE", { dateStyle: "full" }).format(new Date());
}

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const marca = await obtenerEmpresaBrandingService();

  return (
    <div className="min-h-dvh bg-background">
      {/* Barra lateral translúcida (escritorio) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[17rem] flex-col border-r border-outline-variant bg-background/85 p-4 backdrop-blur-xl lg:flex">
        <Brand nombre={marca.nombre_comercial} logoUrl={marca.logo_url} className="mb-6 p-1" />
        <DesktopNav />
        <div className="mt-auto border-t border-outline-variant pt-3">
          <SidebarFooter />
        </div>
      </aside>

      {/* Encabezado translúcido (móvil) */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-outline-variant bg-background/85 px-4 backdrop-blur-xl lg:hidden">
        <Brand nombre={marca.nombre_comercial} logoUrl={marca.logo_url} />
        <div className="flex items-center gap-1">
          <Link
            href="/configuracion"
            aria-label="Configuración"
            className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Icon name="settings" size={20} />
          </Link>
          <UserMenu email={user.email} logoutAction={logout} />
        </div>
      </header>

      {/* Encabezado translúcido (escritorio) */}
      <header className="fixed right-0 top-0 z-30 hidden h-16 items-center justify-between border-b border-outline-variant bg-background/85 px-6 backdrop-blur-xl lg:flex lg:left-[17rem]">
        <p className="text-label-lg text-on-surface-variant">{fechaHoyLarga()}</p>
        <UserMenu email={user.email} logoutAction={logout} />
      </header>

      {/* Contenido */}
      <main className="pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-10 lg:pl-[17rem] lg:pt-16">
        <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
          {children}
        </div>
      </main>

      {/* Tab bar translúcido (móvil) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant bg-background/85 backdrop-blur-xl lg:hidden">
        <div className="h-16">
          <BottomNav />
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  );
}