import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { BellRing, Search } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { useListSentReminders } from "../hooks/use-list-sent-reminders";
import type { DateRange } from "../types";

interface SentRemindersModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  trackingId?: string;
  organizationIds?: string[];
  dateRange: DateRange;
}

function formatSentAt(date: Date | null) {
  if (!date) return "";
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SentRemindersModal({
  isOpen,
  onOpenChange,
  trackingId,
  organizationIds,
  dateRange,
}: SentRemindersModalProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { occurrences, isLoading } = useListSentReminders({
    trackingId,
    organizationIds,
    startDate: dateRange.from?.toISOString(),
    endDate: dateRange.to?.toISOString(),
    enabled: isOpen,
  });

  const term = searchTerm.toLowerCase();
  const filtered = occurrences?.filter((occ) => {
    if (!term) return true;
    const r = occ.reminder;
    const leadName =
      r.lead?.name ?? r.conversation?.lead?.name ?? r.action?.title ?? "";
    return (
      r.message.toLowerCase().includes(term) ||
      leadName.toLowerCase().includes(term) ||
      (r.notifyPhone ?? "").toLowerCase().includes(term)
    );
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lembretes enviados</DialogTitle>
          <DialogDescription>
            Lembretes disparados via WhatsApp no período selecionado.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por mensagem, lead ou telefone..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>

          <ScrollArea className="h-[420px] pr-4">
            <div className="flex flex-col gap-3 pb-1">
              {isLoading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton className="h-16 w-full" key={i} />
                ))}

              {!isLoading && filtered?.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <BellRing className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">
                    Nenhum lembrete enviado
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tente ajustar o período ou os filtros do dashboard.
                  </p>
                </div>
              )}

              {!isLoading &&
                filtered?.map((occ) => {
                  const r = occ.reminder;
                  const lead = r.lead ?? r.conversation?.lead ?? null;
                  const contextLabel = lead
                    ? "Lead"
                    : r.action
                      ? "Tarefa"
                      : r.tracking
                        ? r.tracking.name
                        : "Lembrete";
                  const href = lead
                    ? `/contatos/${lead.id}`
                    : r.action
                      ? `/forge/${r.action.id}`
                      : null;

                  const Item = (
                    <div className="w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-all hover:border-primary hover:bg-accent">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15 text-success shrink-0">
                        <BellRing className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <span className="font-medium line-clamp-1">
                            {lead?.name ?? r.action?.title ?? contextLabel}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatSentAt(occ.sentAt)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {r.message}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="rounded bg-muted px-1.5 py-0.5">
                            {contextLabel}
                          </span>
                          {r.notifyPhone && <span>{r.notifyPhone}</span>}
                          {r.createdBy?.name && (
                            <span>· por {r.createdBy.name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );

                  return href ? (
                    <Link key={occ.id} href={href}>
                      {Item}
                    </Link>
                  ) : (
                    <div key={occ.id}>{Item}</div>
                  );
                })}
            </div>
          </ScrollArea>
        </form>
      </DialogContent>
    </Dialog>
  );
}
