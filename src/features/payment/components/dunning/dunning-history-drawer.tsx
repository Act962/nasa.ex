"use client";

/**
 * DunningHistoryDrawer — drawer lateral que lista todas as execuções
 * (PaymentDunningExecution) de UMA entry RECEIVABLE específica.
 *
 * Mostra cronograma: PENDING (futuro) → SENT/FAILED/SKIPPED (passado).
 * Útil pro user entender "que lembretes o sistema já mandou pro cliente".
 */

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  MessageSquare,
  Smartphone,
  CheckCircle2,
  XCircle,
  Clock,
  SkipForward,
  Loader2,
} from "lucide-react";
import { useDunningExecutionsByEntry } from "../../hooks/use-payment-dunning";

const CHANNEL_ICONS = {
  EMAIL:    Mail,
  WHATSAPP: MessageSquare,
  SMS:      Smartphone,
} as const;

const STATUS_META = {
  PENDING: { label: "Agendado",  Icon: Clock,         color: "text-amber-600 bg-amber-500/10 border-amber-500/30" },
  SENT:    { label: "Enviado",   Icon: CheckCircle2,  color: "text-green-600 bg-green-500/10 border-green-500/30" },
  FAILED:  { label: "Falhou",    Icon: XCircle,       color: "text-red-600 bg-red-500/10 border-red-500/30" },
  SKIPPED: { label: "Ignorado",  Icon: SkipForward,   color: "text-slate-500 bg-slate-500/10 border-slate-500/30" },
} as const;

interface Props {
  entryId:   string | null;
  entryName: string | null;
  onClose:   () => void;
}

export function DunningHistoryDrawer({ entryId, entryName, onClose }: Props) {
  const { data, isLoading } = useDunningExecutionsByEntry(entryId);

  return (
    <Sheet open={!!entryId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto p-0"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b sticky top-0 bg-background z-10">
          <SheetTitle>Histórico de cobrança</SheetTitle>
          {entryName && (
            <p className="text-xs text-muted-foreground">{entryName}</p>
          )}
        </SheetHeader>

        <div className="px-6 py-6 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin mr-2" /> Carregando…
            </div>
          ) : !data?.executions?.length ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma execução de régua pra este lançamento ainda.
              </p>
            </Card>
          ) : (
            data.executions.map((exec) => {
              const meta    = STATUS_META[exec.status];
              const StatusIcon = meta.Icon;
              const ChannelIcon = CHANNEL_ICONS[exec.channel] ?? Mail;
              const scheduledLabel = new Date(exec.scheduledFor).toLocaleString("pt-BR");
              const executedLabel  = exec.executedAt
                ? new Date(exec.executedAt).toLocaleString("pt-BR")
                : null;
              return (
                <Card key={exec.id} className="p-3">
                  <div className="flex items-start gap-3">
                    <div className={`size-8 rounded-md flex items-center justify-center shrink-0 ${meta.color.split(" ").filter(c => c.startsWith("bg") || c.startsWith("text")).join(" ")}`}>
                      <StatusIcon className="size-4" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] h-4 ${meta.color}`}>
                          {meta.label}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] h-4 gap-1">
                          <ChannelIcon className="size-2.5" />
                          {exec.channel}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Agendado pra: <span className="text-foreground">{scheduledLabel}</span>
                      </p>
                      {executedLabel && (
                        <p className="text-xs text-muted-foreground">
                          Executado em: <span className="text-foreground">{executedLabel}</span>
                        </p>
                      )}
                      {exec.messageId && (
                        <p className="text-[11px] text-muted-foreground font-mono truncate">
                          msg: {exec.messageId}
                        </p>
                      )}
                      {exec.errorMessage && (
                        <p className="text-[11px] text-red-500">
                          {exec.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
