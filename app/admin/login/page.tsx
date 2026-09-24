import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Field, inputClass } from "@/components/ui/field";
import { currentUser } from "@/lib/auth";
import { storeConfig } from "@/lib/config/store.config";
import { adminRepo } from "@/lib/data/repository";
import { t } from "@/lib/i18n";
import { login } from "./actions";

export const metadata: Metadata = {
  title: t("admin.login.title"),
  robots: { index: false, follow: false },
  manifest: "/admin.webmanifest",
  icons: { icon: storeConfig.identity.logo, apple: "/admin-icon/192" },
};

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  if (!adminRepo) notFound();
  if (await currentUser()) redirect("/admin");
  const { error } = await searchParams;

  return (
    <main id="main" className="flex flex-1 items-center justify-center bg-surface-alt px-4 py-7">
      <form action={login} className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2">
          <Image src={storeConfig.identity.logo} alt="" width={32} height={32} unoptimized />
          <div>
            <p className="text-sm text-text-muted">{storeConfig.identity.name}</p>
            <h1 className="text-2xl font-semibold">{t("admin.login.title")}</h1>
          </div>
        </div>
        {(error === "invalid" || error === "rate") && (
          <p role="alert" className="rounded-md bg-surface-alt px-3 py-2 text-sm text-danger">
            {t(error === "rate" ? "admin.login.rate" : "admin.login.invalid")}
          </p>
        )}
        <Field id="username" label={t("admin.login.username")}>
          <input id="username" name="username" autoComplete="username" required autoCapitalize="none" className={inputClass()} />
        </Field>
        <Field id="password" label={t("admin.login.password")}>
          <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass()} />
        </Field>
        <SubmitButton>{t("admin.login.submit")}</SubmitButton>
      </form>
    </main>
  );
}
