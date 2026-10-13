import type { ReactNode } from "react";
import { cn } from "./cn";
import { Icon } from "./icon";

export type AlertTone = "error" | "warning" | "success" | "info";

interface ToneConfig {
  icon: string;
  container: string;
}

const TONES: Record<AlertTone, ToneConfig> = {
  error: {
    icon: "error",
    container: "bg-error-container text-on-error-container",
  },
  warning: {
    icon: "error",
    container: "bg-status-por-vencer-bg text-status-por-vencer-text",
  },
  success: {
    icon: "check_circle",
    container: "bg-status-pagada-bg text-status-pagada-text",
  },
  info: {
    icon: "info",
    container: "bg-secondary-container text-on-secondary-container",
  },
};

export interface AlertProps {
  tone?: AlertTone;
  /** Título opcional en negrita sobre el mensaje. */
  title?: string;
  /** Icono opcional; por defecto el del tono. */
  icon?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Aviso con superficie de color para errores o mensajes destacados de una
 * página o sección. Para errores de campo se usa `InlineAlert` (más discreto).
 */
export function Alert({ tone = "error", title, icon, children, className }: AlertProps) {
  const config = TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-body-sm",
        config.container,
        className
      )}
    >
      <Icon name={icon ?? config.icon} size={18} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        {title && <p className="text-label-md">{title}</p>}
        <div className={cn(title && "mt-0.5")}>{children}</div>
      </div>
    </div>
  );
}
