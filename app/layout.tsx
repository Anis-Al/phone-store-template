import type { Metadata } from "next";
import { storeConfig } from "@/lib/config/store.config";
import { dir, locale } from "@/lib/i18n";
import "./globals.css";

const { identity, seo, contact } = storeConfig;

export const metadata: Metadata = {
  metadataBase: new URL(seo.siteUrl),
  title: { default: seo.title, template: `%s | ${identity.name}` },
  description: seo.description,
  applicationName: identity.name,
  icons: { icon: identity.logo, apple: identity.logo },
  openGraph: {
    type: "website",
    siteName: identity.name,
    locale: `${locale}_${contact.address.country}`,
    title: seo.title,
    description: seo.description,
    images: [{ url: seo.ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={locale} dir={dir}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
