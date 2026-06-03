"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryTrackings } from "@/features/trackings/hooks/use-trackings";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  usePreviewImport,
  useImportWorkflow,
} from "../hooks/use-workflow-clipboard-api";
import {
  REF_BEHAVIOR,
  type BlueprintV2,
  type ImportPreview,
  type RefMapping,
  type RefMappingDecision,
  type RefType,
} from "../lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blueprint: BlueprintV2;
  /**
   * Workflow alvo (quando colar nós num workflow existente).
   * Se omitido, dialog assume modo "criar novo workflow" e pergunta tracking.
   */
  targetWorkflowId?: string;
  /** Tracking pré-selecionado (current tracking do canvas). */
  defaultTargetTrackingId?: string;
  /** Callback após import bem-sucedido. */
  onImported?: (result: { workflowId: string; nodesCreated: number }) => void;
}

const REF_TYPE_LABELS: Record<RefType, string> = {
  tag: "Tag",
  "tag-group": "Grupo de tags",
  status: "Status",
  column: "Coluna",
  user: "Responsável",
  tracking: "Tracking",
  form: "Formulário",
  agenda: "Agenda",
  "forge-product": "Produto",
  "forge-contract-template": "Template de contrato",
  "linnker-page": "Página Linnker",
  "nbox-file": "Arquivo Nbox",
  "nasa-route-course": "Curso NASA Route",
  workflow: "Workflow",
};

export function WorkflowImportMappingDialog({
  open,
  onOpenChange,
  blueprint,
  targetWorkflowId,
  defaultTargetTrackingId,
  onImported,
}: Props) {
  const isAppendMode = !!targetWorkflowId;
  const { trackings } = useQueryTrackings();
  const [targetTrackingId, setTargetTrackingId] = useState<string>(
    defaultTargetTrackingId ?? "",
  );
  const [mapping, setMapping] = useState<RefMapping>({});
  const [nameOverride, setNameOverride] = useState<string>(
    blueprint.workflow?.name ?? "",
  );

  const previewMut = usePreviewImport();
  const importMut = useImportWorkflow();
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  // Roda preview quando muda tracking destino. Inicializa mapping com
  // sugestões automáticas (auto-match >= 0.7 → reuse, fallback create).
  useEffect(() => {
    if (!open) return;
    if (!targetTrackingId) return;
    previewMut.mutate(
      {
        blueprint: { formatVersion: 1, refs: blueprint.refs } as any,
        targetTrackingId,
      },
      {
        onSuccess: (data) => {
          setPreview(data);
          const initial: RefMapping = {};
          for (const item of data.refs) {
            const key = `${item.ref.type}:${item.ref.slug}`;
            if (item.autoMatch && item.autoMatch.score >= 0.7) {
              initial[key] = {
                kind: "reuse",
                targetId: item.autoMatch.targetId,
              };
            } else if (item.behavior === "auto-createable") {
              initial[key] = { kind: "create" };
            } else {
              initial[key] = { kind: "skip" };
            }
          }
          setMapping(initial);
        },
        onError: (err) => {
          toast.error(`Falha ao calcular sugestões: ${err.message}`);
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetTrackingId, blueprint]);

  const handleDecide = (key: string, decision: RefMappingDecision) => {
    setMapping((prev) => ({ ...prev, [key]: decision }));
  };

  const refsRows = preview?.refs ?? [];

  const summary = useMemo(() => {
    let reuse = 0,
      create = 0,
      skip = 0;
    for (const v of Object.values(mapping)) {
      if (v.kind === "reuse") reuse++;
      else if (v.kind === "create") create++;
      else skip++;
    }
    return { reuse, create, skip };
  }, [mapping]);

  const handleImport = () => {
    if (isAppendMode) {
      importMut.mutate(
        {
          mode: "append-nodes",
          blueprint: blueprint as any,
          targetWorkflowId: targetWorkflowId!,
          mapping,
        },
        {
          onSuccess: (data) => {
            toast.success(
              `${data.nodesCreated} nó(s) colados (${data.edgesCreated} conexões)`,
            );
            onImported?.({ workflowId: data.workflowId, nodesCreated: data.nodesCreated });
            onOpenChange(false);
          },
          onError: (err) => toast.error(`Falha ao colar: ${err.message}`),
        },
      );
      return;
    }
    if (!targetTrackingId) {
      toast.error("Selecione um tracking de destino");
      return;
    }
    importMut.mutate(
      {
        mode: "create-workflow",
        blueprint: blueprint as any,
        targetTrackingId,
        mapping,
        nameOverride: nameOverride || undefined,
        isActive: false,
      },
      {
        onSuccess: (data) => {
          toast.success(
            `Workflow criado com ${data.nodesCreated} nós. Revise e ative quando estiver pronto.`,
          );
          onImported?.({ workflowId: data.workflowId, nodesCreated: data.nodesCreated });
          onOpenChange(false);
        },
        onError: (err) => toast.error(`Falha no import: ${err.message}`),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isAppendMode
              ? `Colar ${blueprint.nodes.length} nó(s) no workflow atual`
              : `Importar workflow "${blueprint.workflow?.name ?? "(sem nome)"}"`}
          </DialogTitle>
          <DialogDescription>
            {blueprint.source.organizationName && (
              <>
                Origem:{" "}
                <strong>{blueprint.source.organizationName}</strong>
                {blueprint.source.trackingName &&
                  ` / ${blueprint.source.trackingName}`}
                {blueprint.source.workflowName &&
                  ` / ${blueprint.source.workflowName}`}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {!isAppendMode && (
          <div className="space-y-3 border-b pb-3">
            <div className="space-y-1.5">
              <Label>Tracking de destino</Label>
              <Select
                value={targetTrackingId}
                onValueChange={setTargetTrackingId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o tracking" />
                </SelectTrigger>
                <SelectContent>
                  {trackings.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nome do workflow (opcional)</Label>
              <input
                type="text"
                value={nameOverride}
                onChange={(e) => setNameOverride(e.target.value)}
                placeholder={blueprint.workflow?.name}
                className="w-full rounded-md border px-3 py-2 text-sm bg-background"
              />
            </div>
          </div>
        )}

        {!targetTrackingId && !isAppendMode ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Selecione um tracking de destino acima pra calcular sugestões.
          </div>
        ) : previewMut.isPending ? (
          <div className="py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Calculando sugestões de mapeamento…
          </div>
        ) : refsRows.length === 0 ? (
          <div className="py-6 text-center text-sm text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-2">
            <CheckCircle2 className="size-4" />
            Sem refs externas — pode importar direto.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 text-xs">
              <span className="font-medium">{refsRows.length} refs:</span>
              <Badge variant="secondary">
                {summary.reuse} reutilizar
              </Badge>
              <Badge className="bg-violet-500/15 text-violet-700 border-violet-500/40 dark:text-violet-300">
                {summary.create} criar
              </Badge>
              {summary.skip > 0 && (
                <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/40 dark:text-amber-300">
                  {summary.skip} pular
                </Badge>
              )}
            </div>

            <ScrollArea className="max-h-[50vh] -mx-6 px-6">
              <div className="space-y-3 py-2">
                {refsRows.map((row) => {
                  const key = `${row.ref.type}:${row.ref.slug}`;
                  const decision = mapping[key];
                  const canCreate = row.behavior === "auto-createable";
                  return (
                    <div
                      key={key}
                      className="rounded-md border p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {row.ref.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {REF_TYPE_LABELS[row.ref.type as RefType] ??
                              row.ref.type}{" "}
                            ·{" "}
                            <span className="font-mono text-[10px]">
                              {row.ref.slug}
                            </span>
                          </p>
                        </div>
                        {row.autoMatch && row.autoMatch.score >= 0.7 && (
                          <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:text-emerald-300 gap-1">
                            <Sparkles className="size-3" /> auto
                          </Badge>
                        )}
                      </div>

                      <RadioGroup
                        value={decision?.kind ?? "skip"}
                        onValueChange={(v) => {
                          if (v === "reuse") {
                            const target =
                              row.autoMatch?.targetId ??
                              row.alternatives[0]?.id;
                            if (target) {
                              handleDecide(key, { kind: "reuse", targetId: target });
                            } else {
                              handleDecide(key, { kind: "skip" });
                            }
                          } else if (v === "create") {
                            handleDecide(key, { kind: "create" });
                          } else {
                            handleDecide(key, { kind: "skip" });
                          }
                        }}
                        className="flex flex-wrap gap-3"
                      >
                        {(row.autoMatch || row.alternatives.length > 0) && (
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <RadioGroupItem value="reuse" />
                            Reutilizar existente
                          </label>
                        )}
                        {canCreate && (
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <RadioGroupItem value="create" />
                            Criar nova com nome "{row.ref.label}"
                          </label>
                        )}
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer text-muted-foreground">
                          <RadioGroupItem value="skip" />
                          Pular (deixa placeholder)
                        </label>
                      </RadioGroup>

                      {decision?.kind === "reuse" &&
                        (row.autoMatch || row.alternatives.length > 0) && (
                          <Select
                            value={
                              decision.kind === "reuse"
                                ? decision.targetId
                                : undefined
                            }
                            onValueChange={(v) =>
                              handleDecide(key, { kind: "reuse", targetId: v })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Escolha um destino" />
                            </SelectTrigger>
                            <SelectContent>
                              {row.autoMatch && (
                                <SelectItem value={row.autoMatch.targetId}>
                                  {row.autoMatch.targetLabel} (
                                  {Math.round(row.autoMatch.score * 100)}%
                                  match)
                                </SelectItem>
                              )}
                              {row.alternatives.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.label} ({Math.round(a.score * 100)}%)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}

        {summary.skip > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs">
            <AlertTriangle className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p>
              {summary.skip} referência(s) marcadas como "pular". Os nodes
              correspondentes vão ficar com placeholders não resolvidos — o
              executor avisa e skipa, mas você precisa editar depois.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={importMut.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={
              importMut.isPending ||
              (!isAppendMode && !targetTrackingId) ||
              previewMut.isPending
            }
          >
            {importMut.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isAppendMode ? (
              `Colar ${blueprint.nodes.length} nó(s)`
            ) : (
              "Criar workflow"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
