"use client";

import { useState } from "react";
import { Copy, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { compareWithAverage, type AdMetrics } from "@/features/trafego/lib/order-ads-metrics";
import {
  AD_METRIC_LABELS,
  describeMetricMeaning,
  describeWaitBeforeChange,
  diagnoseIndicator,
} from "@/features/trafego/lib/quality-diagnosis";
import { cn } from "@/lib/utils";
import { useAnalyzeAdForFix, useApplyAdFix } from "@/features/trafego/hooks/use-trafego-campaign-builder";
import { AverageArrow } from "../campaign-overview/average-arrow";

/**
 * Seta do indicador; quando é vermelha, vira botão com o diagnóstico e as ações de correção
 * (spec 0128, RF-7..RF-12). Sem `canBuild`, mostra só o diagnóstico.
 */

export interface IndicatorPopoverAd {
  id: string;
  name: string;
  metrics: AdMetrics;
  benchmark: AdMetrics | null;
  benchmarkScope: "objective" | "account";
  evaluateFrom: string | null;
}

type FixMode = "replace" | "duplicate";

export function IndicatorPopover({
  orderId,
  ad,
  metric,
  canFix,
  isEnabled,
}: {
  orderId: string;
  ad: IndicatorPopoverAd;
  metric: keyof AdMetrics;
  canFix: boolean;
  /** Período de teste interno (RF-14): sem ele, só a seta. */
  isEnabled: boolean;
}) {
  const comparison = compareWithAverage(metric, ad.metrics[metric], ad.benchmark?.[metric]);
  const diagnosis = comparison ? diagnoseIndicator(metric, comparison.direction) : null;
  const [message, setMessage] = useState("");
  const [headline, setHeadline] = useState("");
  const [visualTip, setVisualTip] = useState<string | null>(null);
  const [policyWarnings, setPolicyWarnings] = useState<string[]>([]);
  const [pendingMode, setPendingMode] = useState<FixMode | null>(null);
  const analyze = useAnalyzeAdForFix();
  const applyFix = useApplyAdFix();

  const arrow = <AverageArrow metric={metric} value={ad.metrics[metric]} average={ad.benchmark?.[metric]} />;
  if (!isEnabled || !comparison) return arrow;

  const isBad = comparison.tone === "bad";
  const isGood = comparison.tone === "good";
  const metricLabel = AD_METRIC_LABELS[metric];
  const title = diagnosis?.title ?? `${metricLabel} ${comparison.direction === "up" ? "acima" : "abaixo"} da média`;
  const waitHint = isBad ? describeWaitBeforeChange(ad.evaluateFrom) : null;
  // Correção só faz sentido onde há diagnóstico de problema.
  const canOfferFix = canFix && isBad && Boolean(diagnosis);
  const hasSuggestion = message.trim().length > 0;

  function requestAnalysis() {
    analyze.mutate(
      { orderId, adId: ad.id, metrics: ad.metrics, benchmark: ad.benchmark },
      {
        onSuccess: (suggestion) => {
          setMessage(suggestion.correctedMessage);
          setHeadline(suggestion.correctedHeadline);
          setVisualTip(suggestion.visualTip);
          setPolicyWarnings(suggestion.policyWarnings);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  function runFix(mode: FixMode) {
    applyFix.mutate(
      {
        orderId,
        adId: ad.id,
        mode,
        message: message.trim(),
        headline: headline.trim() || null,
        isPolicyWarningConfirmed: policyWarnings.length > 0,
      },
      {
        onSuccess: () =>
          toast.success(mode === "replace" ? "Anúncio corrigido na Meta." : "Cópia corrigida criada, pausada."),
        onError: (error) => toast.error(error.message),
        onSettled: () => setPendingMode(null),
      },
    );
  }

  return (
    <span className="relative z-10 inline-flex" onClick={(event) => event.stopPropagation()}>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "rounded-full p-0.5 transition",
              isBad ? "hover:bg-destructive/15" : isGood ? "hover:bg-success/15" : "hover:bg-muted",
            )}
            aria-label={`Ver detalhes: ${title}`}
          >
            {arrow}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] space-y-3 rounded-[20px] p-4 text-sm">
          <div>
            <p className="font-semibold">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {comparison.percent}% {comparison.direction === "up" ? "acima" : "abaixo"} da média{" "}
              {ad.benchmarkScope === "objective" ? "dos anúncios do mesmo objetivo" : "da sua conta"}.
            </p>
          </div>
          {isBad && diagnosis ? (
            <>
              <p>
                <span className="font-medium">Causa provável: </span>
                {diagnosis.cause}
              </p>
              <p>
                <span className="font-medium">Correção: </span>
                {diagnosis.fix}
              </p>
            </>
          ) : (
            <>
              {isGood && <p className="font-medium text-success">Bom sinal: mantenha o que está funcionando neste anúncio.</p>}
              <p className="text-muted-foreground">{describeMetricMeaning(metric)}</p>
            </>
          )}
          {waitHint && <p className="rounded-[12px] bg-warning/10 px-3 py-2 text-xs text-warning">{waitHint}</p>}

          {canOfferFix && !hasSuggestion && (
            <Button className="h-10 w-full rounded-full" onClick={requestAnalysis} disabled={analyze.isPending}>
              {analyze.isPending ? <OrbitaSpinner className="size-4" /> : <Sparkles className="size-4" />}
              Pedir análise do Astro (5 Stars)
            </Button>
          )}

          {canOfferFix && hasSuggestion && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Texto corrigido pelo Astro (pode editar)</p>
              <Input value={headline} onChange={(event) => setHeadline(event.target.value)} maxLength={60} placeholder="Título" />
              <Textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={600} rows={4} />
              {visualTip && <p className="text-xs text-muted-foreground">Na imagem: {visualTip}</p>}
              {policyWarnings.map((warning) => (
                <p key={warning} className="text-xs text-warning">
                  {warning}
                </p>
              ))}
              <div className="flex flex-col gap-2">
                <Button className="h-10 rounded-full" onClick={() => setPendingMode("replace")} disabled={applyFix.isPending}>
                  <Wand2 className="size-4" />
                  Fazer correção nesse criativo
                </Button>
                <Button
                  variant="outline"
                  className="h-10 rounded-full"
                  onClick={() => setPendingMode("duplicate")}
                  disabled={applyFix.isPending}
                >
                  <Copy className="size-4" />
                  Duplicar criativo com correção
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
      <ConfirmDialog
        isOpen={pendingMode !== null}
        title={pendingMode === "replace" ? "Corrigir este anúncio?" : "Duplicar com correção?"}
        description={[
          pendingMode === "replace"
            ? `Um anúncio novo com o texto corrigido entra no lugar de "${ad.name}", que fica pausado.`
            : `Um anúncio novo com o texto corrigido é criado pausado, ao lado de "${ad.name}". Ative quando quiser.`,
          waitHint ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
        confirmText={pendingMode === "replace" ? "Corrigir" : "Duplicar"}
        onConfirm={() => {
          if (pendingMode) runFix(pendingMode);
        }}
        onCancel={() => setPendingMode(null)}
        isLoading={applyFix.isPending}
      />
    </span>
  );
}
