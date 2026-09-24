"use client";

import { Menu, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { t } from "@/lib/i18n";
import { telLink, whatsappLink } from "@/lib/utils";
import type { NavLink } from "./links";

export function MobileNav({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("nav.openMenu")}
        className="inline-flex size-11 items-center justify-center"
      >
        <Menu aria-hidden size={22} />
      </button>
      <Sheet
        open={open}
        onClose={close}
        title={t("nav.menu")}
        side="start"
        footer={
          <div className="grid grid-cols-2 gap-3">
            <a href={telLink()} className={buttonClass({ variant: "secondary" })}>
              <Phone aria-hidden size={18} /> {t("home.call")}
            </a>
            <a href={whatsappLink()} className={buttonClass()}>
              <MessageCircle aria-hidden size={18} /> WhatsApp
            </a>
          </div>
        }
      >
        <nav aria-label={t("nav.main")}>
          <ul className="flex flex-col">
            <li>
              <Link href="/" onClick={close} className="flex min-h-12 items-center text-2xl font-semibold">
                {t("nav.home")}
              </Link>
            </li>
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={close} className="flex min-h-12 items-center text-2xl font-semibold">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Sheet>
    </div>
  );
}
