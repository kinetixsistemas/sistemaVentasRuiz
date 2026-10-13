import type { Metadata } from "next";
import { Brand, NOMBRE_APP } from "@/components/layout/brand";
import { Icon } from "@/components/ui/icon";
import { obtenerEmpresaBrandingService } from "@/features/empresa/service";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

const CAPACIDADES = [
  { icon: "inventory_2", label: "Inventario con foto" },
  { icon: "point_of_sale", label: "Ventas y facturación" },
  { icon: "payments", label: "Cobranza y estados de cuenta" },
];

export default async function LoginPage() {
  const marca = await obtenerEmpresaBrandingService();
  const nombre = marca.nombre_comercial?.trim() || NOMBRE_APP;

  return (
    <main className="flex min-h-dvh bg-background md:flex-row">
      {/* Panel de marca (solo escritorio) */}
      <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-inverse-surface p-10 text-inverse-on-surface md:flex lg:w-[44%] lg:p-12">
        <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5" />
        <div aria-hidden className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-white/5" />

        <div className="relative z-10">
          <Brand inverse nombre={marca.nombre_comercial} logoUrl={marca.logo_url} />
        </div>

        <div className="relative z-10">
          <h2 className="text-headline-lg text-inverse-on-surface">
            La gestión de tu negocio, al día.
          </h2>
          <p className="mt-2 max-w-sm text-body-lg text-inverse-on-surface/70">
            Inventario, ventas y cobranza en una sola app, pensada para el teléfono.
          </p>

          <ul className="mt-8 flex flex-col gap-3">
            {CAPACIDADES.map((c) => (
              <li key={c.label} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon name={c.icon} size={20} />
                </span>
                <span className="text-body-md text-inverse-on-surface/90">{c.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Tarjeta de acceso */}
      <section className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center md:hidden">
            <Brand nombre={marca.nombre_comercial} logoUrl={marca.logo_url} />
          </div>
          <LoginForm />
          <p className="mt-6 text-center text-body-sm text-on-surface-variant">
            {nombre} · Gestión Comercial &amp; PWA
          </p>
        </div>
      </section>
    </main>
  );
}
