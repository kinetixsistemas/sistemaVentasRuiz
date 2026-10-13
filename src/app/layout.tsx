import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/ui/toast";
import { PwaRegister } from "@/components/app/pwa-register";
import "./globals.css";

// Nombre para los metadatos (estático). La marca dinámica de la empresa
// (nombre + logo) se aplica en el shell `(app)` y en el login mediante `Brand`.
const NOMBRE_APP = "Sistemas Kinetix";

export const metadata: Metadata = {
  applicationName: NOMBRE_APP,
  title: {
    default: `${NOMBRE_APP} · Gestión Comercial`,
    template: `%s · ${NOMBRE_APP}`,
  },
  description: "Sistema de inventario, ventas y cobranza para pequeños negocios.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f5f7",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="font-sans">
        <ToastProvider>{children}</ToastProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
