import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/PageHeader";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Badge } from "@/components/ui/badge";
import { Field, inputClass } from "@/components/ui/field";
import { requireRole } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { MIN_PASSWORD } from "@/lib/session";
import { createUser, updateUser } from "./actions";

export const metadata: Metadata = { title: t("admin.users.title") };

export default async function UsersPage() {
  const { user: me, admin } = await requireRole("owner");
  const users = await admin.listUsers();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-5 md:px-6">
      <PageHeader title={t("admin.users.title")} />
      <p className="text-text-muted">{t("admin.users.intro")}</p>

      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {users.map((u) => (
          <li key={u.id} className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{u.name}</span>
              <span className="text-text-muted">@{u.username}</span>
              <Badge>{t(u.role === "owner" ? "admin.users.owner" : "admin.users.staff")}</Badge>
              {u.disabledAt && <Badge tone="danger">{t("admin.users.disabled")}</Badge>}
              {u.id === me.id && <span className="text-sm text-text-muted">({t("admin.users.you")})</span>}
            </div>
            <div className="flex flex-wrap items-start gap-3">
              <ActionForm action={updateUser} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="op" value="password" />
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-semibold">{t("admin.users.newPassword")}</span>
                  <input name="password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD} className={inputClass()} />
                </label>
                <SubmitButton variant="secondary">{t("admin.users.reset")}</SubmitButton>
              </ActionForm>
              {u.id !== me.id && (
                <ActionForm action={updateUser}>
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="op" value={u.disabledAt ? "enable" : "disable"} />
                  <SubmitButton variant="ghost">{t(u.disabledAt ? "admin.users.enable" : "admin.users.disable")}</SubmitButton>
                </ActionForm>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="-mt-4 text-sm text-text-muted">{t("admin.users.resetHint")}</p>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">{t("admin.users.add")}</h2>
        <ActionForm action={createUser} className="grid gap-4 md:grid-cols-2">
          <Field id="u-username" label={t("admin.users.username")}>
            <input id="u-username" name="username" required pattern="[\w.\-]{2,32}" autoCapitalize="none" className={inputClass()} />
          </Field>
          <Field id="u-name" label={t("admin.users.name")}>
            <input id="u-name" name="name" required maxLength={80} className={inputClass()} />
          </Field>
          <Field id="u-role" label={t("admin.users.role")}>
            <select id="u-role" name="role" defaultValue="staff" className={inputClass()}>
              <option value="staff">{t("admin.users.staff")}</option>
              <option value="owner">{t("admin.users.owner")}</option>
            </select>
          </Field>
          <Field id="u-password" label={t("admin.users.password")}>
            <input id="u-password" name="password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD} className={inputClass()} />
          </Field>
          <div>
            <SubmitButton>{t("admin.users.create")}</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
