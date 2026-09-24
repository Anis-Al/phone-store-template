"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/lib/admin";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** <form> bound to a Server Action returning ActionState: shows its error, or a short "saved". */
export function ActionForm({
  action,
  children,
  className,
  okLabel = t("admin.common.saved"),
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  okLabel?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      <p role="status" aria-live="polite" className={cn("basis-full text-sm", state?.error ? "text-danger" : "text-success")}>
        {state?.error ? t(state.error) : state?.ok ? okLabel : ""}
      </p>
    </form>
  );
}
