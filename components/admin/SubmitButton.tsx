"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonStyle } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/** Submit button that disables itself while its form's Server Action runs (no double submit). */
export function SubmitButton({ children, pendingLabel, ...style }: ButtonStyle & { children: ReactNode; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...style}>
      {pending ? (pendingLabel ?? t("admin.common.saving")) : children}
    </Button>
  );
}
