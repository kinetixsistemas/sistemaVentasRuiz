import type { ReactNode } from "react";
import { cn } from "./cn";
import { Icon } from "./icon";

export interface InlineAlertProps {
  children: ReactNode;
  className?: string;
}

/** Mensaje de error inline (junto a un campo o control), con icono y `role="alert"`.
 *
 * Convención: usar `InlineAlert` para errores de un campo/control concreto y
 * `Alert` para errores de una sección o página completa (con superficie). */
export function InlineAlert({ children, className }: InlineAlertProps) {
  return (
    <p
      role="alert"
      className={cn("flex items-center gap-2 text-body-sm text-error", className)}
    >
      <Icon name="error" size={16} />
      {children}
    </p>
  );
}