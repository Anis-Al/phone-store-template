import { MapPin, MessageCircle, Phone } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { storeConfig } from "@/lib/config/store.config";
import { dayRange, t } from "@/lib/i18n";
import { telLink, whatsappLink } from "@/lib/utils";

/** Map + address + hours + call/WhatsApp/directions. Used on home and contact. */
export function StoreLocator({ title = t("home.visitTitle") }: { title?: string }) {
  const { contact, identity } = storeConfig;
  return (
    <section className="bg-surface-alt">
      <div className="mx-auto grid max-w-page gap-6 px-5 py-8 md:grid-cols-2 md:items-center md:gap-8">
        {/* Fixed aspect ratio reserves the space → the lazy iframe can't shift layout. */}
        <div className="aspect-[4/3] overflow-hidden rounded-lg border border-border bg-surface">
          <iframe
            src={contact.mapEmbedUrl}
            title={t("contact.map")}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="size-full border-0"
          />
        </div>
        <div>
          <h2 className="text-3xl font-semibold md:text-4xl">{title}</h2>
          <address className="mt-4 flex gap-2 not-italic">
            <MapPin aria-hidden size={20} className="mt-1 shrink-0 text-text-muted" />
            <span>
              {identity.name}
              <br />
              {contact.address.street}, {contact.address.city}
              <br />
              {contact.address.postalCode} {contact.address.region}
            </span>
          </address>
          <h3 className="mt-5 text-sm font-semibold">{t("home.hours")}</h3>
          <ul className="mt-1 text-text-muted">
            {contact.hours.map((h) => (
              <li key={h.days.join()}>
                {dayRange(h.days)} · {h.opens} – {h.closes}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={telLink()} className={buttonClass()}>
              <Phone aria-hidden size={18} /> {t("home.call")}
            </a>
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "secondary" })}>
              <MessageCircle aria-hidden size={18} /> WhatsApp
            </a>
            <a href={contact.mapUrl} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "ghost" })}>
              {t("home.directions")} ›
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
