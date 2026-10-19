"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { StatusFlow } from "@/generated/prisma/enums";

// Estado de atendimento automático (spec 0113, RF-22): no lugar do botão da IA, o estado da conversa.
const STATE_LABEL: Record<StatusFlow, string> = {
  NEW: "Novo",
  WAITING: "Aguard. atendimento",
  ACTIVE: "Em atendimento",
  FINISHED: "Finalizado",
};

const STATE_CLASS: Record<StatusFlow, string> = {
  NEW: "border-border text-muted-foreground",
  WAITING: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  ACTIVE: "border-blue-500/40 text-blue-600 dark:text-blue-400",
  FINISHED: "border-border text-muted-foreground",
};

interface AttendanceStateBadgeProps {
  statusFlow: StatusFlow;
  isAiAnswering: boolean;
  className?: string;
}

export function AttendanceStateBadge({ statusFlow, isAiAnswering, className }: AttendanceStateBadgeProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={cn("whitespace-nowrap", STATE_CLASS[statusFlow], className)}>
          {STATE_LABEL[statusFlow]}
          {isAiAnswering && statusFlow !== "FINISHED" ? " · IA respondendo" : ""}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        O estado muda sozinho: a IA responde quando ninguém da equipe está na conversa e se cala quando um atendente
        fala. Fluxos e lembretes seguem sempre.
      </TooltipContent>
    </Tooltip>
  );
}
