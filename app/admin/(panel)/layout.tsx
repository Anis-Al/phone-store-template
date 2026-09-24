import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireRole } from "@/lib/auth";
import { storeConfig } from "@/lib/config/store.config";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: { default: t("admin.title"), template: `%s · ${t("admin.title")}` },
  robots: { index: false, follow: false },
  manifest: "/admin.webmanifest",
  icons: { icon: storeConfig.identity.logo, apple: "/admin-icon/192" },
};

// Layouts don't re-run on every navigation, so each page and action calls requireRole() too.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = await requireRole();
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <AdminNav role={user.role} name={user.name} storeName={storeConfig.identity.name} />
      <main id="main" className="min-w-0 flex-1 pb-8 md:pb-0">
        {children}
      </main>
    </div>
  );
}
