"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { GitMergeIcon, ArrowRightIcon } from "lucide-react";
import { toast } from "sonner";
import {
  useMergeLeads,
  useMoveCleanLeads,
} from "../../hooks/use-lead-merge";

type Temperature = "COLD" | "WARM" | "HOT" | "VERY_HOT";

const TEMPERATURE_LABEL: Record<Temperature, string> = {
  COLD: "Frio",
  WARM: "Morno",
  HOT: "Quente",
  VERY_HOT: "Muito quente",
};

export type MergePreviewLead = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  temperature: Temperature;
  amount: string | number;
  statusId: string;
  trackingId: string;
  responsible: { id: string; name: string } | null;
  status: { name: string } | null;
  _count: {
    leadTags: number;
    files: number;
    formResponses: number;
    actions: number;
  };
};

export type MergeConflict = {
  source: MergePreviewLead;
  target: MergePreviewLead;
};

type FieldKey = "name" | "email" | "responsible" | "temperature";
type Choice = "source" | "target";
type ConflictChoices = Partial<Record<FieldKey, Choice>>;

type MergeLeadsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: MergeConflict[];
  cleanLeadIds: string[];
  targetTrackingId: string;
  targetStatusId: string;
  onDone: () => void;
};

function toNumber(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ChooserRow({
  label,
  targetLabel,
  sourceLabel,
  value,
  onChange,
}: {
  label: string;
  targetLabel: string;
  sourceLabel: string;
  value: Choice;
  onChange: (choice: Choice) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-1">
        {(["target", "source"] as const).map((option) => {
          const active = value === option;
          const text = option === "target" ? targetLabel : sourceLabel;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={cn(
                "max-w-32 truncate rounded-md border px-2 py-0.5 transition-colors",
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-transparent bg-muted text-muted-foreground hover:bg-secondary",
              )}
              title={text}
            >
              {text || "—"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MergeLeadsDialog({
  open,
  onOpenChange,
  conflicts,
  cleanLeadIds,
  targetTrackingId,
  targetStatusId,
  onDone,
}: MergeLeadsDialogProps) {
  const mergeLeads = useMergeLeads();
  const moveCleanLeads = useMoveCleanLeads();
  const [choicesByLead, setChoicesByLead] = useState<
    Record<string, ConflictChoices>
  >({});

  const isPending = mergeLeads.isPending || moveCleanLeads.isPending;

  const setChoice = (sourceId: string, field: FieldKey, choice: Choice) => {
    setChoicesByLead((prev) => ({
      ...prev,
      [sourceId]: { ...prev[sourceId], [field]: choice },
    }));
  };

  const getChoice = (sourceId: string, field: FieldKey): Choice =>
    choicesByLead[sourceId]?.[field] ?? "target";

  const handleConfirm = async () => {
    try {
      await mergeLeads.mutateAsync({
        merges: conflicts.map((conflict) => ({
          sourceLeadId: conflict.source.id,
          targetLeadId: conflict.target.id,
          targetStatusId,
          choices: choicesByLead[conflict.source.id] ?? {},
        })),
      });

      if (cleanLeadIds.length > 0) {
        await moveCleanLeads.mutateAsync({
          leadsIds: cleanLeadIds,
          trackingId: targetTrackingId,
          statusId: targetStatusId,
        });
      }

      toast.success(
        conflicts.length === 1
          ? "Lead mesclado com sucesso"
          : `${conflicts.length} leads mesclados com sucesso`,
      );
      onOpenChange(false);
      onDone();
    } catch {
      // toasts de erro já saem dos hooks
    }
  };

  const summary = useMemo(
    () => ({
      conflicts: conflicts.length,
      clean: cleanLeadIds.length,
    }),
    [conflicts.length, cleanLeadIds.length],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMergeIcon className="size-4 text-primary" />
            Mesclar leads duplicados
          </DialogTitle>
          <DialogDescription>
            {summary.conflicts === 1
              ? "1 contato já existe no tracking de destino."
              : `${summary.conflicts} contatos já existem no tracking de destino.`}{" "}
            As tags, arquivos, formulários e ações são somados; escolha qual dado
            prevalece nos campos divergentes.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-96 -mx-1 px-1">
          <div className="space-y-3">
            {conflicts.map(({ source, target }) => {
              const unionBadges = [
                { label: "tags", n: source._count.leadTags },
                { label: "arquivos", n: source._count.files },
                { label: "forms", n: source._count.formResponses },
                { label: "ações", n: source._count.actions },
              ].filter((item) => item.n > 0);

              const amountSum =
                toNumber(target.amount) + toNumber(source.amount);
              const amountDiffers =
                toNumber(source.amount) > 0 && toNumber(target.amount) > 0;

              const showName = source.name !== target.name;
              const showEmail =
                (source.email ?? "") !== (target.email ?? "") &&
                (!!source.email || !!target.email);
              const showResponsible =
                (source.responsible?.id ?? "") !==
                  (target.responsible?.id ?? "") &&
                (!!source.responsible || !!target.responsible);
              const showTemperature = source.temperature !== target.temperature;

              return (
                <div
                  key={source.id}
                  className="rounded-lg border bg-card p-3 space-y-2.5"
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate text-muted-foreground line-through">
                      {source.name}
                    </span>
                    <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{target.name}</span>
                    {target.phone && (
                      <Badge variant="secondary" className="ml-auto shrink-0 text-[10px]">
                        {target.phone}
                      </Badge>
                    )}
                  </div>

                  {unionBadges.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      {unionBadges.map((item) => (
                        <Badge
                          key={item.label}
                          variant="outline"
                          className="text-[10px] font-normal"
                        >
                          +{item.n} {item.label}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {(showName ||
                    showEmail ||
                    showResponsible ||
                    showTemperature ||
                    amountDiffers) && <Separator />}

                  <div className="space-y-1.5">
                    {showName && (
                      <ChooserRow
                        label="Nome"
                        targetLabel={target.name}
                        sourceLabel={source.name}
                        value={getChoice(source.id, "name")}
                        onChange={(choice) =>
                          setChoice(source.id, "name", choice)
                        }
                      />
                    )}
                    {showEmail && (
                      <ChooserRow
                        label="E-mail"
                        targetLabel={target.email ?? "—"}
                        sourceLabel={source.email ?? "—"}
                        value={getChoice(source.id, "email")}
                        onChange={(choice) =>
                          setChoice(source.id, "email", choice)
                        }
                      />
                    )}
                    {showResponsible && (
                      <ChooserRow
                        label="Responsável"
                        targetLabel={target.responsible?.name ?? "—"}
                        sourceLabel={source.responsible?.name ?? "—"}
                        value={getChoice(source.id, "responsible")}
                        onChange={(choice) =>
                          setChoice(source.id, "responsible", choice)
                        }
                      />
                    )}
                    {showTemperature && (
                      <ChooserRow
                        label="Temperatura"
                        targetLabel={TEMPERATURE_LABEL[target.temperature]}
                        sourceLabel={TEMPERATURE_LABEL[source.temperature]}
                        value={getChoice(source.id, "temperature")}
                        onChange={(choice) =>
                          setChoice(source.id, "temperature", choice)
                        }
                      />
                    )}
                    {amountDiffers && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Valor</span>
                        <span className="font-medium">
                          {amountSum.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}{" "}
                          <span className="text-muted-foreground font-normal">
                            (somado)
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {summary.clean > 0 && (
          <p className="text-xs text-muted-foreground">
            {summary.clean === 1
              ? "1 lead sem duplicata será movido normalmente."
              : `${summary.clean} leads sem duplicata serão movidos normalmente.`}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            <GitMergeIcon className="size-4" />
            {isPending
              ? "Mesclando..."
              : `Mesclar ${summary.conflicts} ${
                  summary.conflicts === 1 ? "lead" : "leads"
                }`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
