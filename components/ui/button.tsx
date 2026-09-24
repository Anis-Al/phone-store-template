import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-primary text-primary-fg",
  secondary: "border border-primary text-primary bg-transparent",
  "secondary-on-dark": "border border-accent text-accent bg-transparent", // accent = link blue for dark surfaces
  inverse: "bg-inverse text-inverse-fg",
  ghost: "text-primary bg-transparent",
} as const;

const sizes = {
  md: "min-h-11 px-5 text-base",
  lg: "min-h-12 px-6 text-lg font-light",
  icon: "size-11 shrink-0",
} as const;

export type ButtonStyle = { variant?: keyof typeof variants; size?: keyof typeof sizes; className?: string };

/** Shared by <Button> and <Link>s that should look like buttons. */
export const buttonClass = ({ variant = "primary", size = "md", className }: ButtonStyle = {}) =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-pill whitespace-nowrap transition-transform",
    "active:scale-95 disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyle) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...props} />;
}
