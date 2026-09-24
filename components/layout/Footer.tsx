import Link from "next/link";
import { storeConfig } from "@/lib/config/store.config";
import { dayRange, t } from "@/lib/i18n";
import { telLink, whatsappLink } from "@/lib/utils";
import { infoLinks, shopLinks, type NavLink } from "./links";

function Column({ title, links }: { title: string; links: NavLink[] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-text">{title}</h2>
      <ul className="mt-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="inline-flex min-h-11 items-center hover:text-text">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  const { identity, contact } = storeConfig;
  return (
    <footer className="border-t border-border bg-surface-alt text-sm text-text-muted">
      <div className="mx-auto grid max-w-page grid-cols-2 gap-6 px-5 py-7 lg:grid-cols-4">
        <div className="col-span-2 lg:col-span-1">
          <p className="text-base font-semibold text-text">{identity.name}</p>
          <p className="mt-2">{identity.tagline}</p>
        </div>
        <Column title={t("footer.shop")} links={shopLinks()} />
        <Column title={t("footer.info")} links={infoLinks()} />
        <div className="col-span-2 lg:col-span-1">
          <h2 className="text-sm font-semibold text-text">{t("footer.contact")}</h2>
          <address className="mt-2 not-italic">
            <a href={telLink()} className="inline-flex min-h-11 items-center hover:text-text">
              {contact.phone}
            </a>
            <br />
            <a href={whatsappLink()} className="inline-flex min-h-11 items-center hover:text-text">
              WhatsApp
            </a>
            <br />
            <a href={`mailto:${contact.email}`} className="inline-flex min-h-11 items-center hover:text-text">
              {contact.email}
            </a>
            <p className="mt-2">
              {contact.address.street}, {contact.address.city}
            </p>
          </address>
          <ul className="mt-2">
            {contact.hours.map((h) => (
              <li key={h.days.join()}>
                {dayRange(h.days)} · {h.opens}–{h.closes}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-page px-5 py-4 text-xs">
          © {new Date().getFullYear()} {identity.name}. {t("footer.rights")}
        </p>
      </div>
    </footer>
  );
}
