import { storeConfig } from "@/lib/config/store.config";
import { t } from "@/lib/i18n";

/** Lets staff install the admin as a home-screen app. Outside /admin so proxy.ts doesn't gate it (fetched without cookies). */
export function GET() {
  const { name } = storeConfig.identity;
  return Response.json(
    {
      name: `${name} · ${t("admin.title")}`,
      short_name: name,
      start_url: "/admin",
      scope: "/admin",
      display: "standalone",
      icons: [192, 512].map((s) => ({ src: `/admin-icon/${s}`, sizes: `${s}x${s}`, type: "image/png" })),
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
