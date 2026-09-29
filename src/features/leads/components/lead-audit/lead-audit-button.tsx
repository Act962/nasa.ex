"use client";

import { RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuditLead } from "@/features/leads/hooks/use-lead-metrics";

// "Auditar Lead": calcula as métricas do lead, ou recalcula as que já existem.

export function LeadAuditButton({ leadId }: { leadId: string }) {
  const audit = useAuditLead(leadId);

  const handleClick = () =>
    audit.mutate(
      { leadId },
      {
        onSuccess: (result) => {
          if (result.notice) toast.info(result.notice);
        },
        onError: () => toast.error("Não consegui auditar este lead agora."),
      },
    );

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 shrink-0 gap-1 rounded-lg border-sky-500/60 px-2 text-xs text-sky-400 hover:bg-sky-500/10 hover:text-sky-300"
      disabled={audit.isPending}
      onClick={handleClick}
    >
      {audit.isPending ? "Auditando…" : "Auditar Lead"}
      <RefreshCwIcon className={cn("size-3", audit.isPending && "animate-spin")} />
    </Button>
  );
}
