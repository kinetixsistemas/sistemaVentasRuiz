"use client";

import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "./cn";
import { Icon } from "./icon";

export type SelectOption = { value: string; label: string };

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  /** Opción "vacía" que actúa como placeholder (p. ej. "Seleccionar…"). */
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, options, placeholder, className, id, ...rest },
  ref
) {
  const selectId = id ?? rest.name;

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-label-md text-on-surface-variant">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "h-11 w-full appearance-none rounded-lg border bg-surface-container px-3.5 pr-10 text-body-md text-on-surface transition-colors focus:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error
              ? "border-error/50 focus:border-error focus:bg-surface-container-lowest focus:ring-2 focus:ring-error/20"
              : "border-transparent focus:border-primary focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20",
            className
          )}
          aria-invalid={Boolean(error)}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Icon
          name="expand_more"
          size={20}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
        />
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
