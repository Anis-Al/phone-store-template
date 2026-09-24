import Image from "next/image";
import Link from "next/link";
import { storeConfig } from "@/lib/config/store.config";
import { t } from "@/lib/i18n";
import { CartButton } from "./CartButton";
import { infoLinks, shopLinks } from "./links";
import { MobileNav } from "./MobileNav";
import { SearchBox } from "./SearchBox";

export function Header() {
  const links = [...shopLinks(), ...infoLinks()];
  return (
    <header className="sticky top-0 z-40 bg-inverse text-inverse-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded-sm focus:bg-surface focus:px-3 focus:py-2 focus:text-text"
      >
        {t("nav.skip")}
      </a>
      <div className="mx-auto flex h-11 max-w-page items-center gap-1 px-2 md:px-5">
        <MobileNav links={links} />
        <Link href="/" className="flex min-h-11 items-center gap-2 px-2 max-md:me-auto">
          <Image src={storeConfig.identity.logo} alt="" width={24} height={24} unoptimized priority />
          <span className="text-sm font-semibold">{storeConfig.identity.name}</span>
        </Link>
        <nav aria-label={t("nav.main")} className="hidden flex-1 justify-center md:flex">
          <ul className="flex gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-flex min-h-11 items-center px-2 text-xs whitespace-nowrap opacity-85 hover:opacity-100 lg:px-3">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <SearchBox />
        <CartButton />
      </div>
    </header>
  );
}
