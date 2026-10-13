"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";
import { Icon } from "./icon";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, className, id, ...rest },
  ref
) {
  const textareaId = id ?? rest.name;

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={textareaId} className="text-label-md text-on-surface-variant">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        className={cn(
          "min-h-11 w-full rounded-lg border bg-surface-container px-3.5 py-2.5 text-body-md text-on-surface transition-colors focus:outline-none",
          "placeholder:text-placeholder",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error
            ? "border-error/50 focus:border-error focus:bg-surface-container-lowest focus:ring-2 focus:ring-error/20"
            : "border-transparent focus:border-primary focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20",
          className
        )}
        aria-invalid={Boolean(error)}
        {...rest}
      />
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
