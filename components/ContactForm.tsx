"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MessageCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { t, type TKey } from "@/lib/i18n";
import { dzPhone } from "@/lib/order";
import { whatsappLink } from "@/lib/utils";

const schema = z.object({
  name: z.string().trim().min(2, "errors.name").max(80, "errors.name"),
  phone: z.union([z.literal(""), dzPhone]),
  message: z.string().trim().min(10, "errors.message").max(1000),
});

/**
 * ponytail: no backend inbox — the message opens pre-filled in WhatsApp, where the store already
 * answers customers. Add an /api/contact + admin view if a store needs email/ticketing.
 */
export function ContactForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { name: "", phone: "", message: "" },
  });
  const err = (k: "name" | "phone" | "message") => (errors[k]?.message ? t(errors[k].message as TKey) : undefined);

  return (
    <form
      data-hide-fab
      noValidate
      onSubmit={handleSubmit(({ name, phone, message }) => {
        const text = t("contact.waMessage", { name, phone: phone ? ` (${phone})` : "", message });
        window.open(whatsappLink(text), "_blank", "noopener");
      })}
      className="flex flex-col gap-4"
    >
      <Field id="c-name" label={t("contact.name")} error={err("name")}>
        <input id="c-name" autoComplete="name" {...register("name")} aria-invalid={!!errors.name} className={inputClass(!!errors.name)} />
      </Field>
      <Field id="c-phone" label={t("contact.phone")} error={err("phone")}>
        <input
          id="c-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          {...register("phone")}
          aria-invalid={!!errors.phone}
          className={inputClass(!!errors.phone)}
        />
      </Field>
      <Field id="c-message" label={t("contact.message")} error={err("message")} hint={t("contact.sendHint")}>
        <textarea
          id="c-message"
          rows={5}
          {...register("message")}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "c-message-error" : "c-message-hint"}
          className={inputClass(!!errors.message)}
        />
      </Field>
      <Button type="submit" className="self-start">
        <MessageCircle aria-hidden size={18} /> {t("contact.send")}
      </Button>
    </form>
  );
}
