"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";
import { Icon } from "./icon";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Mensaje de error mostrado bajo el campo (reemplaza al hint). */
  error?: string;
  hint?: string;
  /** Nombre de un icono (ver mapa en icon.tsx) a la izquierda. */
  icon?: string;
  /** Elemento alineado a la derecha dentro del campo (p. ej. mostrar contraseña). */
  endAdornment?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, icon, endAdornment, className, id, ...rest },
  ref
) {
  const inputId = id ?? rest.name;

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-label-md text-on-surface-variant">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <Icon
            name={icon}
            size={19}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-11 w-full rounded-lg border bg-surface-container px-3.5 text-body-md text-on-surface transition-colors focus:outline-none",
            "placeholder:text-placeholder",
            "disabled:cursor-not-allowed disabled:opacity-50",
            icon && "pl-10",
            Boolean(endAdornment) && "pr-11",
            error
              ? "border-error/50 focus:border-error focus:bg-surface-container-lowest focus:ring-2 focus:ring-error/20"
              : "border-transparent focus:border-primary focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20",
            className
          )}
          aria-invalid={Boolean(error)}
          {...rest}
        />
        {endAdornment && (
          <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">
            {endAdornment}
          </div>
        )}
      </div>
      {error ? (
        <p className="flex items-center gap-1 text-body-sm text-error" role="alert">
          <Icon name="error" size={14} strokeWidth={2} />
          {error}
        </p>
      ) : hint ? (
        <p className="text-body-sm text-on-surface-variant">{hint}</p>
      ) : null}
    </div>
  );
});
