"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, CalendarClock, ExternalLink, MessageCircle, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAccountingObligations, useSetObligationStatus } from "@/features/accounting/hooks/use-accounting-obligations";
import {
  daysUntilFiscalDate,
  describeDaysUntil,
  formatFiscalDate,
  formatPeriodLabel,
} from "@/features/accounting/lib/profile/tax-display";
import { FiscalTermHint } from "../shared/fiscal-term-hint";
import { ObligationStatusBadge } from "./obligation-status-badge";

type ObligationFilter = "all" | "pending" | "overdue";
type SettableObligationStatus = "DONE" | "NOT_APPLICABLE" | "PENDING";

const FILTER_OPTIONS: Array<{ id: ObligationFilter; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "pending", label: "Pendentes" },
  { id: "overdue", label: "Atrasadas" },
];

function monthGroupLabel(date: Date): string {
  const label = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Prazos fiscais da empresa, agrupados pelo mês de vencimento. */
export function FiscalCalendarSection({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const [filter, setFilter] = useState<ObligationFilter>("all");
  // Na primeira carga pede ao servidor para recalcular o calendário a partir do perfil.
  const obligationsQuery = useAccountingObligations({ refresh: true });
  const setObligationStatus = useSetObligationStatus();

  const groupedObligations = useMemo(() => {
    const obligations = obligationsQuery.data?.obligations ?? [];
    const filteredObligations = obligations.filter((obligation) => {
      if (filter === "pending") return obligation.status === "PENDING";
      if (filter === "overdue") return obligation.status === "OVERDUE";
      return true;
    });
    const groups = new Map<string, { label: string; obligations: typeof filteredObligations }>();
    for (const obligation of filteredObligations) {
      const groupKey = `${obligation.dueDate.getUTCFullYear()}-${obligation.dueDate.getUTCMonth()}`;
      const group = groups.get(groupKey) ?? { label: monthGroupLabel(obligation.dueDate), obligations: [] };
      group.obligations.push(obligation);
      groups.set(groupKey, group);
    }
    return Array.from(groups.entries());
  }, [obligationsQuery.data, filter]);

  function handleSetStatus(obligationId: string, status: SettableObligationStatus) {
    setObligationStatus.mutate(
      { obligationId, status },
      {
        onSuccess: () =>
          toast.success(status === "DONE" ? "Marcada como feita." : status === "NOT_APPLICABLE" ? "Marcada como não se aplica." : "Obrigação reaberta."),
        onError: (error) => toast.error(error.message || "Não foi possível atualizar."),
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <MessageCircle className="mt-0.5 size-4 shrink-0 text-success" />
          <span>
            Os avisos chegam por WhatsApp 5, 2 e 0 dias antes (configure os telefones no{" "}
            <button type="button" className="text-info hover:underline dark:text-info" onClick={() => onNavigate?.("profile")}>
              Perfil fiscal
            </button>
            ).
          </span>
        </p>
        <div className="flex shrink-0 gap-1 rounded-lg border p-0.5" role="tablist" aria-label="Filtrar obrigações">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={filter === option.id}
              onClick={() => setFilter(option.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                filter === option.id ? "bg-info/10 text-info dark:text-info" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {obligationsQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : obligationsQuery.isError ? (
        <Card className="py-0">
          <CardContent className="flex flex-col items-start gap-3 py-6">
            <p className="text-sm text-muted-foreground">Não foi possível carregar o calendário agora.</p>
            <Button size="sm" variant="outline" onClick={() => obligationsQuery.refetch()}>
              Tentar de novo
            </Button>
          </CardContent>
        </Card>
      ) : groupedObligations.length === 0 ? (
        <Card className="py-0">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CalendarCheck className="size-8 text-muted-foreground" />
            <p className="max-w-md text-sm text-muted-foreground">
              {filter === "all"
                ? "Nenhum prazo fiscal nos próximos 60 dias. O calendário é montado a partir do seu regime e das informações do Perfil fiscal."
                : "Nada por aqui neste filtro. Ótimo sinal!"}
            </p>
            {filter === "all" && (
              <Button size="sm" variant="outline" onClick={() => onNavigate?.("profile")}>
                Revisar perfil fiscal
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {groupedObligations.map(([groupKey, group]) => (
            <section key={groupKey} className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <CalendarClock className="size-3.5" />
                {group.label}
              </h3>
              <ul className="divide-y rounded-lg border">
                {group.obligations.map((obligation) => {
                  const daysUntil = daysUntilFiscalDate(obligation.dueDate);
                  const isOpen = obligation.status === "PENDING" || obligation.status === "OVERDUE";
                  return (
                    <li key={obligation.id} className="flex items-start gap-3 px-3 py-3">
                      <div className="flex w-11 shrink-0 flex-col items-center rounded-md bg-muted/60 py-1">
                        <span className="text-base font-bold leading-none tabular-nums">{obligation.dueDate.getUTCDate()}</span>
                        <span className="text-[10px] uppercase text-muted-foreground">
                          {obligation.dueDate.toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "")}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                          {obligation.label}
                          {obligation.glossaryTermId && <FiscalTermHint termId={obligation.glossaryTermId} />}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span>Competência {formatPeriodLabel(obligation.period)}</span>
                          <span>· vence {formatFiscalDate(obligation.dueDate, true)}</span>
                          {isOpen && (
                            <span
                              className={cn(
                                daysUntil < 0 && "text-destructive dark:text-destructive",
                                daysUntil >= 0 && daysUntil <= 5 && "text-warning dark:text-warning",
                              )}
                            >
                              · {describeDaysUntil(daysUntil)}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <ObligationStatusBadge status={obligation.status} />
                          {obligation.officialUrl && (
                            <a
                              href={obligation.officialUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-info hover:underline"
                            >
                              <ExternalLink className="size-3" />
                              Site oficial
                            </a>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="size-8 shrink-0" aria-label={`Ações de ${obligation.label}`}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {obligation.status !== "DONE" && (
                            <DropdownMenuItem onClick={() => handleSetStatus(obligation.id, "DONE")}>Marcar como feita</DropdownMenuItem>
                          )}
                          {obligation.status !== "NOT_APPLICABLE" && (
                            <DropdownMenuItem onClick={() => handleSetStatus(obligation.id, "NOT_APPLICABLE")}>Não se aplica à empresa</DropdownMenuItem>
                          )}
                          {!isOpen && <DropdownMenuItem onClick={() => handleSetStatus(obligation.id, "PENDING")}>Reabrir</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
