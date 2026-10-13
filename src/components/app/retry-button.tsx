"use client";

import { Icon } from "@/components/ui/icon";

export function RetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-label-lg text-on-primary transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <Icon name="refresh" size={18} />
      Reintentar
    </button>
  );
}