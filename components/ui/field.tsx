import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const inputClass = (invalid?: boolean) =>
  cn(
    "w-full min-h-11 rounded-md border bg-surface px-4 py-2 text-base text-text placeholder:text-text-muted",
    invalid ? "border-danger" : "border-border",
  );

/** Label + control + error, wired for screen readers via id / aria-describedby. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
