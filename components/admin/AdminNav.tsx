"use client";

import { Boxes, LayoutDashboard, LogOut, ReceiptText, Smartphone, Store, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/admin/login/actions";
import type { Role } from "@/lib/data/repository";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/admin", label: t("admin.nav.dashboard"), Icon: LayoutDashboard },
  { href: "/admin/orders", label: t("admin.nav.orders"), Icon: ReceiptText },
  { href: "/admin/products", label: t("admin.nav.products"), Icon: Smartphone },
  { href: "/admin/stock", label: t("admin.nav.stock"), Icon: Boxes },
];

/** Sidebar on desktop; top bar + bottom tab bar on mobile (the shop owner runs the store from a phone). */
export function AdminNav({ role, name, storeName }: { role: Role; name: string; storeName: string }) {
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === href : path.startsWith(href));
  const users = role === "owner" && { href: "/admin/users", label: t("admin.nav.users"), Icon: Users };
  const iconLink = "inline-flex size-11 items-center justify-center rounded-md";

  return (
    <>
      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex h-11 items-center gap-1 bg-inverse ps-4 pe-1 text-inverse-fg md:hidden print:hidden">
        <span className="me-auto truncate text-sm font-semibold">{storeName}</span>
        {users && (
          <Link href={users.href} aria-label={users.label} className={iconLink}>
            <users.Icon className="size-5" aria-hidden />
          </Link>
        )}
        <Link href="/" aria-label={t("admin.nav.store")} className={iconLink}>
          <Store className="size-5" aria-hidden />
        </Link>
        <form action={logout}>
          <button type="submit" aria-label={t("admin.nav.logout")} className={iconLink}>
            <LogOut className="size-5" aria-hidden />
          </button>
        </form>
      </header>

      {/* mobile bottom tabs / desktop sidebar */}
      <nav
        aria-label={t("admin.nav.main")}
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]",
          "md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:shrink-0 md:flex-col md:border-t-0 md:border-e md:bg-surface-alt md:p-3",
          "print:hidden",
        )}
      >
        <p className="hidden px-3 py-3 font-semibold md:block">{storeName}</p>
        <ul className="grid grid-cols-4 md:flex md:flex-col md:gap-1">
          {[...tabs, ...(users ? [users] : [])].map(({ href, label, Icon }) => (
            <li key={href} className={href === "/admin/users" ? "hidden md:block" : undefined}>
              <Link
                href={href}
                aria-current={active(href) ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-xs md:min-h-11 md:flex-row md:justify-start md:gap-3 md:rounded-md md:px-3 md:text-sm",
                  active(href) ? "font-semibold text-primary md:bg-surface" : "text-text-muted md:text-text",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-auto hidden flex-col gap-1 border-t border-border pt-3 md:flex">
          <p className="truncate px-3 text-sm text-text-muted">{name}</p>
          <Link href="/" className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm">
            <Store className="size-5" aria-hidden />
            {t("admin.nav.store")}
          </Link>
          <form action={logout}>
            <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm">
              <LogOut className="size-5" aria-hidden />
              {t("admin.nav.logout")}
            </button>
          </form>
        </div>
      </nav>
    </>
  );
}
