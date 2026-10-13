"use client";

import { usePathname } from "next/navigation";
import { esRutaActiva, navItemClasses, type NavItem } from "./app-nav";
import { Icon } from "@/components/ui/icon";
import Link from "next/link";

const CONFIG_ITEM: NavItem = { href: "/configuracion", label: "Configuración", icon: "settings" };

/** Enlace "Configuración" del pie de la barra lateral, con estado activo. */
export function SidebarFooter() {
  const pathname = usePathname();
  const active = esRutaActiva(pathname, CONFIG_ITEM.href);
  return (
    <Link
      href={CONFIG_ITEM.href}
      aria-current={active ? "page" : undefined}
      className={navItemClasses(active)}
    >
      <Icon name={CONFIG_ITEM.icon} size={20} strokeWidth={active ? 2.2 : 1.8} />
      {CONFIG_ITEM.label}
    </Link>
  );
}
