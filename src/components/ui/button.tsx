"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import Link from "next/link";
import { cn } from "./cn";
import { Icon } from "./icon";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Muestra un spinner y deshabilita el botón. */
  loading?: boolean;
  /** Nombre de un icono (ver mapa en icon.tsx) a la izquierda. */
  icon?: string;
  /** Nombre de un icono a la derecha. */
  iconRight?: string;
  /** Si se pasa, el botón se renderiza como <Link>. */
  href?: string;
}

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-lg text-label-lg whitespace-nowrap select-none transition-[transform,background-color,color,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40";

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-10 px-3.5",
  md: "h-11 px-4",
  lg: "h-12 min-w-[120px] rounded-full px-6",
  icon: "h-11 w-11 p-0",
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary shadow-md hover:bg-primary/90 active:bg-primary/85",
  secondary: "bg-surface-container text-on-surface hover:bg-surface-container-high",
  ghost: "bg-transparent text-primary hover:bg-primary/10",
  danger: "bg-error text-on-error shadow-md hover:bg-error/90",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    icon,
    iconRight,
    href,
    className,
    disabled,
    children,
    type = "button",
    ...rest
  },
  ref
) {
  const classes = cn(baseClasses, sizeClasses[size], variantClasses[variant], className);
  const iconSize = size === "lg" ? 22 : 20;

  const content = (
    <>
      {loading ? (
        <Icon name="progress_activity" size={iconSize} className="animate-spin" />
      ) : icon ? (
        <Icon name={icon} size={iconSize} />
      ) : null}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize} />}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={classes}
        aria-disabled={Boolean(disabled || loading)}
        tabIndex={disabled ? -1 : undefined}
        {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      {...rest}
    >
      {content}
    </button>
  );
});
