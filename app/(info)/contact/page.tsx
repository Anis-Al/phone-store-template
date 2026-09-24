import { Mail, MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { StoreLocator } from "@/components/layout/StoreLocator";
import { StoreJsonLd } from "@/components/StoreJsonLd";
import { storeConfig } from "@/lib/config/store.config";
import { t } from "@/lib/i18n";
import { telLink, whatsappLink } from "@/lib/utils";

export const metadata: Metadata = {
  title: t("contact.title"),
  description: t("contact.description"),
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  const { contact } = storeConfig;
  const channels = [
    { icon: Phone, label: contact.phone, href: telLink() },
    { icon: MessageCircle, label: "WhatsApp", href: whatsappLink() },
    { icon: Mail, label: contact.email, href: `mailto:${contact.email}` },
  ];
  return (
    <>
      <div className="mx-auto grid max-w-page gap-7 px-5 py-7 md:grid-cols-2 md:py-8">
        <div>
          <h1 className="text-4xl font-semibold md:text-5xl">{t("contact.title")}</h1>
          <p className="mt-3 text-lg text-text-muted">{t("contact.description")}</p>
          <ul className="mt-6 flex flex-col gap-1">
            {channels.map((c) => (
              <li key={c.href}>
                <a href={c.href} className="inline-flex min-h-11 items-center gap-3 text-lg text-primary">
                  <c.icon aria-hidden size={20} /> {c.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <section className="rounded-lg border border-border p-5 md:p-6">
          <h2 className="mb-4 text-2xl font-semibold">{t("contact.formTitle")}</h2>
          <ContactForm />
        </section>
      </div>
      <StoreLocator />
      <StoreJsonLd />
    </>
  );
}
