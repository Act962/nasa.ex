import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MessageTemplateStatus } from "@/http/whats-oficial";

const STATUS_STYLE: Record<
  string,
  { label: string; className: string }
> = {
  APPROVED: {
    label: "Aprovado",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  PENDING: {
    label: "Em análise",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  IN_APPEAL: {
    label: "Em recurso",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  REJECTED: {
    label: "Rejeitado",
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
  PAUSED: {
    label: "Pausado",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  },
  DISABLED: {
    label: "Desativado",
    className: "bg-muted text-muted-foreground",
  },
};

export function TemplateStatusBadge({
  status,
}: {
  status: MessageTemplateStatus;
}) {
  const style = STATUS_STYLE[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="secondary" className={cn("border-0", style.className)}>
      {style.label}
    </Badge>
  );
}
