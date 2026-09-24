import { storeConfig } from "@/lib/config/store.config";
import { SCHEMA_DAYS } from "@/lib/i18n";
import { absoluteUrl } from "@/lib/utils";
import { JsonLd } from "./JsonLd";

/** LocalBusiness (MobilePhoneStore) built entirely from store.config.ts. */
export function StoreJsonLd() {
  const { identity, contact, seo } = storeConfig;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "MobilePhoneStore",
        "@id": `${seo.siteUrl}/#store`,
        name: identity.name,
        description: seo.description,
        url: seo.siteUrl,
        logo: absoluteUrl(identity.logo),
        image: absoluteUrl(seo.ogImage),
        telephone: contact.phone,
        email: contact.email,
        address: {
          "@type": "PostalAddress",
          streetAddress: contact.address.street,
          addressLocality: contact.address.city,
          addressRegion: contact.address.region,
          postalCode: contact.address.postalCode,
          addressCountry: contact.address.country,
        },
        ...(contact.geo && {
          geo: { "@type": "GeoCoordinates", latitude: contact.geo.lat, longitude: contact.geo.lng },
        }),
        hasMap: contact.mapUrl,
        openingHoursSpecification: contact.hours.map((h) => ({
          "@type": "OpeningHoursSpecification",
          dayOfWeek: h.days.map((d) => SCHEMA_DAYS[d]),
          opens: h.opens,
          closes: h.closes,
        })),
      }}
    />
  );
}
