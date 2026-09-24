import { MessageCircle } from "lucide-react";
import { storeConfig } from "@/lib/config/store.config";
import { t } from "@/lib/i18n";
import { whatsappLink } from "@/lib/utils";

export function WhatsAppFab() {
  return (
    <a
      data-fab
      href={whatsappLink(t("whatsapp.greeting", { store: storeConfig.identity.name }))}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("whatsapp.fab")}
      className="fixed end-5 bottom-5 z-30 inline-flex size-14 items-center justify-center rounded-pill bg-success text-surface transition-transform active:scale-95"
    >
      <MessageCircle aria-hidden size={26} />
    </a>
  );
}
