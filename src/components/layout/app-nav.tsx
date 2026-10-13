"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";

export type NavItem = { href: string; label: string; icon: string };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: "home" },
  { href: "/inventario", label: "Inventario", icon: "inventory_2" },
  { href: "/clientes", label: "Clientes", icon: "groups" },
  { href: "/ventas", label: "Ventas", icon: "point_of_sale" },
  { href: "/cobranza", label: "Cobranza", icon: "payments" },
];

/** Devuelve si una ruta está activa (includes para las subrutas). */
export function esRutaActiva(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => esRutaActiva(pathname, href);
}

export function navItemClasses(active: boolean): string {
  return cn(
    "flex h-11 items-center gap-3 rounded-lg px-3 text-label-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
    active
      ? "bg-primary/10 text-primary"
      : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
  );
}

/** Enlace de la barra lateral con el estado activo compartido. */
export function SidebarLink({ item, className }: { item: NavItem; className?: string }) {
  const isActive = useIsActive();
  const active = isActive(item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(navItemClasses(active), className)}
    >
      <Icon name={item.icon} size={20} strokeWidth={active ? 2.2 : 1.8} />
      {item.label}
    </Link>
  );
}

/** Navegación lateral (escritorio). */
export function DesktopNav() {
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => (
        <SidebarLink key={item.href} item={item} />
      ))}
    </nav>
  );
}

/** Tab bar inferior fija (móvil) estilo iOS. */
export function BottomNav() {
  const isActive = useIsActive();
  return (
    <nav
      className="grid h-full"
      style={{ gridTemplateColumns: `repeat(${NAV_ITEMS.length}, minmax(0, 1fr))` }}
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="flex min-h-0 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset"
          >
            <span
              className={cn(
                "flex h-full w-full flex-col items-center justify-center gap-0.5 transition-colors",
                active ? "text-primary" : "text-on-surface-variant"
              )}
            >
              <Icon name={item.icon} size={23} strokeWidth={active ? 2.3 : 1.8} />
              <span className="text-label-sm">{item.label}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
