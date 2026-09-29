"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  ExternalLink,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAstroFeedStore } from "@/features/astro/voice/use-astro-feed-store";
import { cn } from "@/lib/utils";
import {
  GUIDE_STEPS,
  PROGRESS_MILESTONES,
  guideStepLink,
  phaseOf,
  type MetaAccountIds,
  type GuideCopyKey,
  type GuideStep,
} from "../../lib/whatsapp-connect-guide";
import { CopyField } from "./copy-field";
import { GuideShot } from "./guide-shot";
import { MetaLogo } from "./meta-logo";
import { InstructionChecklist } from "./instruction-checklist";
import { StayOnTrack, openMetaSideWindow, useReturnNudge } from "./stay-on-track";

const COPY_LABELS: Record<GuideCopyKey, string> = {
  callbackUrl: "URL de callback",
  verifyToken: "Verificar token",
};

/**
 * Telas da Meta uma de cada vez (spec 0040, RF-3): print com a seta vermelha,
 * instrução curta, link, e o Astro comemorando cada fase concluída.
 */
export function MetaGuideStepper({
  initialSlug,
  cheeredIds,
  copyValues,
  accountIds,
  renderStepExtra,
  canAdvance,
  onStepChange,
  onCheer,
  onFinished,
  isTitleHidden = false,
}: {
  /** O título do passo já aparece no topo do popup. */
  isTitleHidden?: boolean;
  /** Passo salvo no banco — o cliente continua de onde parou. */
  initialSlug: string | null;
  /** Balões do Astro já mostrados (salvos no banco, não repetem). */
  cheeredIds: ReadonlySet<string>;
  copyValues: Partial<Record<GuideCopyKey, string | null>>;
  /** App e portfólio do cliente — os links abrem direto neles. */
  accountIds: MetaAccountIds;
  renderStepExtra?: (step: GuideStep) => ReactNode;
  canAdvance?: (step: GuideStep) => boolean;
  onStepChange: (step: GuideStep, index: number, total: number) => void;
  onCheer: (cheerId: string) => void;
  onFinished: () => void;
}) {
  const [isManualMode, setIsManualMode] = useState(false);
  const [hasOpenedMeta, setHasOpenedMeta] = useState(false);
  const isNudging = useReturnNudge(hasOpenedMeta);
  const steps = useMemo(
    () =>
      GUIDE_STEPS.filter(
        (step) =>
          step.phase !== "payment" && (isManualMode || !step.isAutomated),
      ),
    [isManualMode],
  );
  const [stepIndex, setStepIndex] = useState(() => {
    const savedIndex = steps.findIndex((step) => step.slug === initialSlug);
    return savedIndex >= 0 ? savedIndex : 0;
  });
  const safeIndex = Math.min(stepIndex, steps.length - 1);
  const step = steps[safeIndex];
  const phase = phaseOf(step.phase);
  const isLast = safeIndex === steps.length - 1;
  const isBlocked = canAdvance ? !canAdvance(step) : false;
  const stepLink = guideStepLink(step, accountIds);
  const isPersonalLink = Boolean(step.linkKey && accountIds.appId);

  function cheer(cheerId: string, headline: string) {
    if (cheeredIds.has(cheerId)) return;
    onCheer(cheerId);
    useAstroFeedStore
      .getState()
      .push(
        {
          id: `whatsapp-guide:${cheerId}`,
          kind: "alert",
          headline,
          priority: "info",
        },
        9_000,
      );
  }

  function goTo(index: number) {
    const bounded = Math.max(0, Math.min(index, steps.length - 1));
    setStepIndex(bounded);
    onStepChange(steps[bounded], bounded, steps.length);
  }

  function goNext() {
    const nextStep = steps[safeIndex + 1];
    if (nextStep && nextStep.phase !== step.phase)
      cheer(`cheer:phase-${step.phase}`, phase.cheer);
    const percent = Math.round(((safeIndex + 1) / steps.length) * 100);
    const milestone = [...PROGRESS_MILESTONES]
      .reverse()
      .find((item) => percent >= item.percent);
    if (milestone)
      cheer(`cheer:milestone-${milestone.percent}`, milestone.headline);
    if (isLast) return onFinished();
    goTo(safeIndex + 1);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-700 dark:text-emerald-400">
            {phase.title}
          </span>
        </span>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={isManualMode} onCheckedChange={setIsManualMode} />
          Prefiro fazer tudo na Meta
        </label>
      </div>

      <StayOnTrack />

      <div
        key={step.n}
        className="animate-in fade-in slide-in-from-right-3 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto duration-300"
      >
        <div className="shrink-0">
          {!isTitleHidden && <p className="font-semibold">{step.title}</p>}
          <InstructionChecklist instruction={step.instruction} className="mt-1.5" />
        </div>

        {step.tip && (
          <p className="flex shrink-0 items-start gap-2 rounded-md bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-300">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {step.tip}
          </p>
        )}

        {step.isAutomated && (
          <p className="flex shrink-0 items-center gap-2 rounded-md bg-sky-500/10 p-2 text-xs text-sky-800 dark:text-sky-300">
            <Bot className="size-4 shrink-0" /> A ÓRBITA faz este passo por
            você. Ele aparece aqui só no modo &quot;fazer tudo na Meta&quot;.
          </p>
        )}

        {stepLink && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              asChild
              size="sm"
              variant="outline"
              className="border-[#0866FF]/40 text-[#0866FF] hover:bg-[#0866FF]/10 hover:text-[#0866FF] dark:text-[#4d94ff]"
            >
              <a
                href={stepLink}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => {
                  setHasOpenedMeta(true);
                  if (openMetaSideWindow(stepLink)) event.preventDefault();
                }}
              >
                <MetaLogo className="size-4" />
                {isPersonalLink ? "Abrir no seu app" : "Abrir na Meta"}{" "}
                <ExternalLink className="size-3.5 opacity-70" />
              </a>
            </Button>
            {isPersonalLink && (
              <span className="text-[11px] text-muted-foreground">
                App {accountIds.appId}
                {accountIds.businessId
                  ? ` · portfólio ${accountIds.businessId}`
                  : ""}
              </span>
            )}
          </div>
        )}

        {step.copy?.map((key) =>
          copyValues[key] ? (
            <CopyField
              key={key}
              label={COPY_LABELS[key]}
              value={copyValues[key] ?? ""}
            />
          ) : null,
        )}

        {step.shot && (
          <GuideShot step={step} isFitted className="min-h-[140px] flex-1" />
        )}
        {renderStepExtra && (
          <div className="shrink-0">{renderStepExtra(step)}</div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => goTo(safeIndex - 1)}
          disabled={safeIndex === 0}
        >
          <ArrowLeft className="size-4" /> Voltar
        </Button>
        {step.choice ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                goTo(
                  steps.findIndex(
                    (item) => item.slug === step.choice?.skipToSlug,
                  ),
                )
              }
            >
              {step.choice.yesLabel}
            </Button>
            <Button
              size="sm"
              onClick={goNext}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {step.choice.noLabel} <ArrowRight className="size-4" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={goNext}
            disabled={isBlocked}
            className={cn(
              !isBlocked && "bg-emerald-600 text-white hover:bg-emerald-700",
              !isBlocked && isNudging && "animate-pulse ring-4 ring-emerald-400/50",
            )}
          >
            {isLast ? (
              <>
                <Sparkles className="size-4" /> Concluir
              </>
            ) : (
              <>
                Fiz, próximo <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
