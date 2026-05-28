"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/spinner";
import { Badge } from "@/components/ui/badge";
import { AlertTriangleIcon, UsersIcon, ZapIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useRouter } from "next/navigation";
import {
  useApplyTrackingPreset,
  useTrackingPresetPreview,
} from "../hooks/use-tracking-presets";
import { cn } from "@/lib/utils";
import { getContrastColor } from "@/utils/get-contrast-color";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetId: string;
  presetName: string;
}

/**
 * Dialog de aplicação de TrackingPreset. 3 steps:
 *  1. Modo: criar novo OU mesclar em tracking existente (+ checkbox prompt AI)
 *  2. Preview de conflitos: pra cada tag conflitante, radio Reusar/Criar Nova
 *  3. Confirmação: resumo + botão "Aplicar"
 *
 * Preview chama backend a cada mudança de modo/target — backend retorna
 * conflitos REAIS contra o banco (não inferência client-side).
 */
export function ApplyPresetDialog({
  open,
  onOpenChange,
  presetId,
  presetName,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<"create" | "merge">("create");
  const [targetTrackingId, setTargetTrackingId] = useState<string>("");
  const [overrideAiPrompt, setOverrideAiPrompt] = useState(false);
  const [tagResolutions, setTagResolutions] = useState<
    Record<string, "reuse" | "createNew">
  >({});

  // Lista trackings da org pra dropdown (só usado em mode=merge)
  const { data: trackingsData } = useQuery({
    ...orpc.tracking.list.queryOptions(),
    enabled: open && mode === "merge",
  });

  // Preview reativo: roda quando mode/target mudam OU step >= 2
  const previewMutation = useTrackingPresetPreview();
  const preview = previewMutation.data;

  useEffect(() => {
    if (!open) return;
    if (mode === "merge" && !targetTrackingId) return;
    previewMutation.mutate({
      presetId,
      mode,
      targetTrackingId: mode === "merge" ? targetTrackingId : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, targetTrackingId, presetId]);

  // Auto-resolve conflitos: default "createNew" (mais seguro, não afeta tag existente)
  useEffect(() => {
    if (!preview) return;
    setTagResolutions((prev) => {
      const next = { ...prev };
      for (const t of preview.tags) {
        if (t.action === "conflict" && !next[t.slug]) {
          next[t.slug] = "createNew";
        }
      }
      return next;
    });
  }, [preview]);

  const conflictingTags = useMemo(
    () => preview?.tags.filter((t) => t.action === "conflict") ?? [],
    [preview],
  );

  const apply = useApplyTrackingPreset();

  const handleClose = () => {
    onOpenChange(false);
    setStep(1);
    setMode("create");
    setTargetTrackingId("");
    setOverrideAiPrompt(false);
    setTagResolutions({});
  };

  const handleConfirm = () => {
    apply.mutate(
      {
        presetId,
        mode,
        targetTrackingId: mode === "merge" ? targetTrackingId : undefined,
        tagConflictResolution: tagResolutions,
        overrideAiPrompt,
      },
      {
        onSuccess: (data) => {
          handleClose();
          router.push(`/tracking/${data.trackingId}`);
        },
      },
    );
  };

  const canAdvance = step === 1 ? mode === "create" || !!targetTrackingId : true;
  const isLoadingPreview = previewMutation.isPending && !preview;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : handleClose())}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Aplicar padrão: {presetName}</DialogTitle>
          <DialogDescription>
            Passo {step} de 3 ·{" "}
            {step === 1
              ? "Escolha como aplicar"
              : step === 2
                ? "Resolva conflitos de tags"
                : "Confirme a aplicação"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          {/* ── Step 1: Modo ───────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <RadioGroup
                value={mode}
                onValueChange={(v) => setMode(v as "create" | "merge")}
              >
                <Label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/50">
                  <RadioGroupItem value="create" className="mt-1" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      Criar novo tracking
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Cria um tracking limpo na sua org com tudo do padrão.
                      Mais seguro — não afeta nenhum tracking existente.
                    </p>
                  </div>
                </Label>
                <Label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/50">
                  <RadioGroupItem value="merge" className="mt-1" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      Mesclar em tracking existente
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Adiciona status, workflows e tags faltantes a um
                      tracking que já existe. Pode afetar automações ativas.
                    </p>
                  </div>
                </Label>
              </RadioGroup>

              {mode === "merge" && (
                <div className="space-y-2 pl-2 border-l-2 border-amber-300">
                  <Label className="text-xs">Tracking destino</Label>
                  <Select
                    value={targetTrackingId}
                    onValueChange={setTargetTrackingId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um tracking" />
                    </SelectTrigger>
                    <SelectContent>
                      {(trackingsData ?? []).map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Label className="flex items-start gap-2 cursor-pointer pt-2">
                    <Checkbox
                      checked={overrideAiPrompt}
                      onCheckedChange={(v) => setOverrideAiPrompt(!!v)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-xs font-medium">
                        Atualizar prompt da IA com o sugerido pelo padrão
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Sobrescreve o prompt atual do AiSettings deste tracking.
                      </p>
                    </div>
                  </Label>

                  {!!preview?.warnings.length && (
                    <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-1 mt-3">
                      <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-medium text-xs">
                        <AlertTriangleIcon className="size-3.5" />
                        Alertas anti-quebra
                      </div>
                      <ul className="text-[11px] text-amber-800 dark:text-amber-300 space-y-0.5 ml-5 list-disc">
                        {preview.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Conflitos de tags ──────────────────────────── */}
          {step === 2 && (
            <div className="space-y-3">
              {isLoadingPreview && (
                <div className="flex items-center justify-center py-8">
                  <Spinner />
                </div>
              )}
              {!isLoadingPreview && conflictingTags.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Nenhum conflito de tag — todas serão criadas novas.
                </div>
              )}
              {!isLoadingPreview && conflictingTags.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Estas tags do padrão têm o mesmo nome de tags JÁ existentes
                    na sua org. Escolha pra cada uma:
                  </p>
                  {conflictingTags.map((tag) => {
                    const resolution = tagResolutions[tag.slug] ?? "createNew";
                    return (
                      <div
                        key={tag.slug}
                        className="rounded-md border p-3 space-y-2 bg-card"
                      >
                        <p className="text-sm font-semibold">{tag.name}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setTagResolutions((p) => ({
                                ...p,
                                [tag.slug]: "reuse",
                              }))
                            }
                            className={cn(
                              "border rounded-md p-2 text-left transition-all",
                              resolution === "reuse"
                                ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                                : "border-border hover:border-primary/50",
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="size-3 rounded-full"
                                style={{
                                  backgroundColor:
                                    "existingTagColor" in tag
                                      ? tag.existingTagColor ?? "#888"
                                      : "#888",
                                }}
                              />
                              <span className="text-xs font-medium">
                                Reusar existente
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                              <UsersIcon className="size-2.5" />
                              {"existingLeadCount" in tag
                                ? `${tag.existingLeadCount} lead(s) vinculado(s)`
                                : ""}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setTagResolutions((p) => ({
                                ...p,
                                [tag.slug]: "createNew",
                              }))
                            }
                            className={cn(
                              "border rounded-md p-2 text-left transition-all",
                              resolution === "createNew"
                                ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                                : "border-border hover:border-primary/50",
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="size-3 rounded-full"
                                style={{ backgroundColor: tag.color }}
                              />
                              <span className="text-xs font-medium">
                                Criar nova
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Cria tag separada (com sufixo se necessário)
                            </div>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* ── Step 3: Confirmação ─────────────────────────────────── */}
          {step === 3 && preview && (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/30 p-4 space-y-2">
                <h4 className="text-sm font-semibold">Resumo da aplicação</h4>
                <ul className="text-xs space-y-1">
                  <li>
                    •{" "}
                    {"willCreate" in preview.tracking
                      ? `Novo tracking: ${preview.tracking.name}`
                      : `Mesclar em: ${preview.tracking.willMergeInto?.name}`}
                  </li>
                  <li>
                    •{" "}
                    {preview.status.filter((s) => s.action === "create").length}{" "}
                    status novos
                    {preview.status.filter((s) => s.action === "alreadyExists")
                      .length > 0 &&
                      ` (${preview.status.filter((s) => s.action === "alreadyExists").length} pulados)`}
                  </li>
                  <li>
                    • Tags:{" "}
                    {
                      Object.values(tagResolutions).filter(
                        (r) => r === "createNew",
                      ).length +
                        preview.tags.filter((t) => t.action === "create").length
                    }{" "}
                    novas,{" "}
                    {
                      Object.values(tagResolutions).filter(
                        (r) => r === "reuse",
                      ).length
                    }{" "}
                    reusadas
                  </li>
                  <li>
                    •{" "}
                    {preview.tagGroups.filter((g) => g.action === "create").length}{" "}
                    grupos de tags novos
                    {preview.tagGroups.filter((g) => g.action === "reuse")
                      .length > 0 &&
                      ` (${preview.tagGroups.filter((g) => g.action === "reuse").length} reusados)`}
                  </li>
                  <li>
                    • {preview.workflows.length} workflows criados
                    {preview.workflows.filter((w) => w.isActive).length > 0 &&
                      ` (${preview.workflows.filter((w) => w.isActive).length} ativos)`}
                  </li>
                </ul>
              </div>

              {preview.starsCost > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200">
                  <ZapIcon className="size-3.5 inline mr-1" />
                  Esta aplicação vai consumir{" "}
                  <b>{preview.starsCost} estrela(s)</b> da sua org.
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              disabled={apply.isPending}
            >
              Voltar
            </Button>
          )}
          <Button variant="ghost" onClick={handleClose} disabled={apply.isPending}>
            Cancelar
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              disabled={!canAdvance || isLoadingPreview}
            >
              Próximo
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={apply.isPending}>
              {apply.isPending ? "Aplicando..." : "Aplicar padrão"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
