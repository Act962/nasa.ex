import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MessageTemplateStatus } from "@/http/whats-oficial";

const STATUS_STYLE: Record<
  string,
  { label: string; className: string }
> = {
  APPROVED: {
    label: "Aprovado",
    className: "bg-success/15 text-success dark:bg-success/20 dark:text-success",
  },
  PENDING: {
    label: "Em análise",
    className: "bg-warning/15 text-warning dark:bg-warning/20 dark:text-warning",
  },
  IN_APPEAL: {
    label: "Em recurso",
    className: "bg-warning/15 text-warning dark:bg-warning/20 dark:text-warning",
  },
  REJECTED: {
    label: "Rejeitado",
    className: "bg-destructive/15 text-destructive dark:bg-destructive/20 dark:text-destructive",
  },
  PAUSED: {
    label: "Pausado",
    className: "bg-warning/15 text-warning dark:bg-warning/20 dark:text-warning",
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
