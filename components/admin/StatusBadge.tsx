import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/data/schemas";
import { t } from "@/lib/i18n";

const tone = { new: "inverse", confirmed: "neutral", ready: "warning", done: "success", cancelled: "danger" } as const;

export const StatusBadge = ({ status }: { status: OrderStatus }) => <Badge tone={tone[status]}>{t(`status.${status}`)}</Badge>;
