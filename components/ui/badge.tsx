import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-surface-alt text-text",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  inverse: "bg-inverse text-inverse-fg",
} as const;

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: keyof typeof tones;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill text-xs font-semibold",
        tone === "neutral" || tone === "inverse" ? "px-2 py-1" : "",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
