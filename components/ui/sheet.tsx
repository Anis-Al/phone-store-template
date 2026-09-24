"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const sides = {
  end: "ms-auto me-0 h-dvh max-h-dvh w-full max-w-md",
  start: "me-auto ms-0 h-dvh max-h-dvh w-full max-w-sm",
  center: "m-auto w-[calc(100%-2*var(--space-4))] max-w-lg max-h-[85dvh] rounded-lg",
} as const;

/**
 * Modal panel on native <dialog>: focus trap, Esc, inert background and top-layer for free.
 * ponytail: no enter/exit animation; add @starting-style if the design wants one.
 */
export function Sheet({
  open,
  onClose,
  title,
  side = "end",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: keyof typeof sides;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()} // backdrop click
      className={cn("bg-surface text-text p-0 backdrop:bg-inverse/40", sides[side])}
    >
      <div className="flex h-full max-h-[inherit] flex-col">
        <header className="flex items-center justify-between border-b border-border px-5 py-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("nav.close")}>
            <X aria-hidden size={22} />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="border-t border-border px-5 py-4">{footer}</footer>}
      </div>
    </dialog>
  );
}
