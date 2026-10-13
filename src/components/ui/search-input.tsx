"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "./cn";
import { Icon } from "./icon";

export interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

/** Campo de búsqueda con icono, con el mismo estilo en todo el sistema. */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ className, type = "search", id, ...rest }, ref) {
    return (
      <div className="relative flex-1">
        <Icon
          name="search"
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
        />
        <input
          ref={ref}
          id={id}
          type={type}
          className={cn(
            "h-11 w-full rounded-lg border border-transparent bg-surface-container pl-10 pr-3 text-body-md text-on-surface transition-colors focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-placeholder",
            className
          )}
          {...rest}
        />
      </div>
    );
  }
);