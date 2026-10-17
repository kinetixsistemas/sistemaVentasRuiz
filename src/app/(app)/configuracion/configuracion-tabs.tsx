"use client";

import { useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";
import { InstalarPwa } from "@/components/app/instalar-pwa";
import { EmpresaForm } from "@/features/empresa/components/empresa-form";
import type { Empresa } from "@/features/empresa/schemas";
import { MiPerfilForm } from "@/features/usuarios/components/mi-perfil-form";
import { UsuariosPanel } from "@/features/usuarios/components/usuarios-panel";
import type { Perfil } from "@/features/usuarios/schemas";

type Tab = "empresa" | "cuenta" | "usuarios" | "app";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "empresa", label: "Empresa", icon: "storefront" },
  { id: "cuenta", label: "Mi usuario", icon: "account_circle" },
  { id: "usuarios", label: "Usuarios", icon: "group" },
  { id: "app", label: "Aplicación", icon: "install_mobile" },
];

export function ConfiguracionTabs({
  empresa,
  usuarios,
  miPerfil,
  email,
  miId,
}: {
  empresa: Empresa | null;
  usuarios: Perfil[];
  miPerfil: Perfil | null;
  email?: string;
  miId: string;
}) {
  const [tab, setTab] = useState<Tab>("empresa");
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    empresa: null,
    cuenta: null,
    usuarios: null,
    app: null,
  });

  function onKeyDown(e: React.KeyboardEvent) {
    const idx = TABS.findIndex((t) => t.id === tab);
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    const id = TABS[next]!.id;
    setTab(id);
    tabRefs.current[id]?.focus();
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Secciones de configuración"
        onKeyDown={onKeyDown}
        className="flex gap-1 rounded-xl bg-surface-container p-1"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            ref={(el) => {
              tabRefs.current[item.id] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            className={cn(
              "flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-label-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              tab === item.id
                ? "bg-surface-container-lowest text-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            <Icon name={item.icon} size={18} />
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="animate-fade-in">
        {tab === "empresa" && <EmpresaForm empresa={empresa} />}
        {tab === "cuenta" && <MiPerfilForm perfil={miPerfil} email={email} />}
        {tab === "usuarios" && <UsuariosPanel usuarios={usuarios} miId={miId} />}
        {tab === "app" && <InstalarPwa />}
      </div>
    </div>
  );
}
