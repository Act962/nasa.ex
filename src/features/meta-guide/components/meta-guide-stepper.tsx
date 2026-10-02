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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useAstroFeedStore } from "@/features/astro/voice/use-astro-feed-store";
import { useAstroWidgetStore } from "@/features/astro/voice/use-astro-widget-store";
import { cn } from "@/lib/utils";
import { findPhase, visibleGuideSteps } from "../lib/guide-helpers";
import type { MetaAccountIds, MetaGuideDefinition, MetaGuideStep } from "../lib/types";
import { CopyField } from "./copy-field";
import { GuideShot } from "./guide-shot";
import { MetaLogo } from "./meta-logo";
import { InstructionChecklist } from "./instruction-checklist";
import { GuideTermsText } from "./guide-terms-text";
import { StayOnTrackDialog, hasSeenStayOnTrack, markStayOnTrackSeen, openMetaSideWindow, useReturnNudge } from "./stay-on-track";

const NO_ACCOUNT_IDS: MetaAccountIds = { appId: null, businessId: null };

/**
 * Telas da Meta uma de cada vez (specs 0040 e 0047): print com a seta vermelha,
 * instrução curta, link, e o Astro comemorando cada fase concluída.
 */
export function MetaGuideStepper<TStep extends MetaGuideStep>({
  guide,
  initialSlug,
  cheeredIds,
  copyValues,
  accountIds = NO_ACCOUNT_IDS,
  renderStepExtra,
  canAdvance,
  onStepChange,
  onCheer,
  onFinished,
  onAskAstro,
  isTitleHidden = false,
}: {
  /** "Não entendi": quem usa o guia fecha o que precisar e abre o Astro com a pergunta. */
  onAskAstro?: (question: string) => void;
  guide: MetaGuideDefinition<TStep>;
  /** O título do passo já aparece no topo do popup. */
  isTitleHidden?: boolean;
  /** Passo salvo no banco — o cliente continua de onde parou. */
  initialSlug: string | null;
  /** Balões do Astro já mostrados (salvos no banco, não repetem). */
  cheeredIds: ReadonlySet<string>;
  copyValues: Partial<Record<string, string | null>>;
  /** App e portfólio do cliente — os links abrem direto neles. */
  accountIds?: MetaAccountIds;
  renderStepExtra?: (step: TStep) => ReactNode;
  canAdvance?: (step: TStep) => boolean;
  onStepChange: (step: TStep, index: number, total: number) => void;
  onCheer: (cheerId: string) => void;
  onFinished: () => void;
}) {
  const [isManualMode, setIsManualMode] = useState(false);
  const [hasOpenedMeta, setHasOpenedMeta] = useState(false);
  const [isStayOnTrackSeen, setIsStayOnTrackSeen] = useState(hasSeenStayOnTrack);
  const [acknowledgedTipSlugs, setAcknowledgedTipSlugs] = useState<Set<string>>(() => new Set());

  function acknowledgeTip(stepSlug: string) {
    setAcknowledgedTipSlugs((current) => new Set(current).add(stepSlug));
  }

  function askAstro(question: string) {
    if (onAskAstro) return onAskAstro(question);
    useAstroWidgetStore.getState().open({ text: question, fromVoice: false });
  }

  function reopenTip(stepSlug: string) {
    setAcknowledgedTipSlugs((current) => {
      const next = new Set(current);
      next.delete(stepSlug);
      return next;
    });
  }
  const isNudging = useReturnNudge(hasOpenedMeta);
  const hasAutomatedSteps = guide.steps.some((step) => step.isAutomated);
  const steps = useMemo(
    () => visibleGuideSteps(guide, isManualMode),
    [guide, isManualMode],
  );
  const [stepIndex, setStepIndex] = useState(() => {
    const savedIndex = steps.findIndex((step) => step.slug === initialSlug);
    return savedIndex >= 0 ? savedIndex : 0;
  });
  const safeIndex = Math.min(stepIndex, steps.length - 1);
  const step = steps[safeIndex];
  const phase = findPhase(guide.phases, step.phase);
  const isLast = safeIndex === steps.length - 1;
  const isBlocked = canAdvance ? !canAdvance(step) : false;
  const stepLink = guide.stepLink
    ? guide.stepLink(step, accountIds)
    : (step.link ?? null);
  const isPersonalLink = guide.isPersonalLink?.(step, accountIds) ?? false;

  function cheer(cheerId: string, headline: string) {
    if (cheeredIds.has(cheerId)) return;
    onCheer(cheerId);
    useAstroFeedStore
      .getState()
      .push(
        {
          id: `${guide.id}:${cheerId}`,
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
    const milestone = [...guide.milestones]
      .reverse()
      .find((item) => percent >= item.percent);
    if (milestone)
      cheer(`cheer:milestone-${milestone.percent}`, milestone.headline);
    if (isLast) return onFinished();
    goTo(safeIndex + 1);
  }

  const isTipOpen = Boolean(step.tip) && !acknowledgedTipSlugs.has(step.slug);
  // A partir do 2º passo, sem disputar a tela com o aviso do passo; depois de confirmado, some de vez.
  const isStayOnTrackOpen = !isStayOnTrackSeen && safeIndex > 0 && !isTipOpen;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <StayOnTrackDialog
        open={isStayOnTrackOpen}
        onConfirm={() => {
          markStayOnTrackSeen();
          setIsStayOnTrackSeen(true);
        }}
      />
      {/* Aviso do passo em popup: só segue depois do "Entendi", e volta pelo chip "Ver aviso". */}
      <Dialog open={isTipOpen} onOpenChange={(isOpen) => !isOpen && acknowledgeTip(step.slug)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] gap-6 px-6 pt-7 pb-6 sm:max-w-md" showCloseButton={false}>
          <DialogHeader className="items-center gap-3 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-warning/15 text-warning">
              <TriangleAlert className="size-7" />
            </span>
            <DialogTitle className="text-lg">Atenção neste passo</DialogTitle>
            <DialogDescription className="text-[15px] leading-relaxed text-muted-foreground">
              {step.tip && <GuideTermsText text={step.tip} />}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button className="h-12 w-full rounded-full text-[15px]" onClick={() => acknowledgeTip(step.slug)}>
              Entendi
            </Button>
            <Button
              variant="ghost"
              className="h-11 w-full rounded-full text-info hover:bg-info/10 hover:text-info"
              onClick={() => {
                acknowledgeTip(step.slug);
                askAstro(`Não entendi este aviso do passo "${step.title}" da conexão do WhatsApp oficial: "${(step.tip ?? "").replace(/\*\*/g, "")}". Me explica de um jeito simples o que eu devo fazer?`);
              }}
            >
              <Bot className="size-4" /> Não entendi, Astro me explique melhor
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 max-md:hidden">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-success/10 px-2.5 py-1 font-medium text-success">
            {phase.title}
          </span>
        </span>
        {hasAutomatedSteps && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={isManualMode} onCheckedChange={setIsManualMode} />
            Prefiro fazer tudo na Meta
          </label>
        )}
      </div>


      <div
        key={step.n}
        className="animate-in fade-in slide-in-from-right-3 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto duration-300"
      >
        <div className="shrink-0">
          {!isTitleHidden && <p className="font-semibold">{step.title}</p>}
          <InstructionChecklist instruction={step.instruction} className="mt-1.5" />
        </div>

        {step.tip && (
          <button
            type="button"
            onClick={() => reopenTip(step.slug)}
            className="flex shrink-0 items-center gap-1.5 self-start rounded-full bg-warning/10 px-3 py-1.5 text-xs font-medium text-warning transition-colors hover:bg-warning/20"
          >
            <TriangleAlert className="size-3.5 shrink-0" /> Ver aviso deste passo
          </button>
        )}

        {step.isAutomated && (
          <p className="flex shrink-0 items-center gap-2 rounded-md bg-info/10 p-2 text-xs text-info">
            <Bot className="size-4 shrink-0" /> A ÓRBITA faz este passo por
            você. Ele aparece aqui só no modo &quot;fazer tudo na Meta&quot;.
          </p>
        )}

        {stepLink && (
          <div
            className={cn(
              "flex shrink-0 flex-wrap items-center gap-2 max-md:order-first max-md:flex-none max-md:flex-col max-md:items-stretch",
              step.isLinkHighlighted && "flex-1 flex-col justify-center",
            )}
          >
            <Button
              asChild
              size={step.isLinkHighlighted ? "lg" : "sm"}
              variant="outline"
              className={cn(
                "border-brand-facebook/40 text-brand-facebook hover:bg-brand-facebook/10 hover:text-brand-facebook",
                step.isLinkHighlighted && "h-14 px-10 text-lg [&_svg]:size-6",
                // Celular: o atalho da Meta é a ação do passo — fica no topo, cheio e azul da Meta.
                "max-md:h-16 max-md:w-full max-md:rounded-full max-md:border-0 max-md:bg-brand-facebook max-md:text-lg max-md:font-bold max-md:text-white max-md:shadow-lg max-md:shadow-brand-facebook/30 max-md:hover:bg-brand-facebook/90 max-md:hover:text-white max-md:[&_svg]:size-7",
                "md:rounded-full md:border-0 md:bg-brand-facebook md:font-bold md:text-white md:hover:bg-brand-facebook/90 md:hover:text-white",
                !step.isLinkHighlighted && "md:h-12 md:px-7 md:text-base md:[&_svg]:size-5",
              )}
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
                {isPersonalLink ? "Abrir na sua conexão" : "Abrir na Meta"}{" "}
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
              label={guide.copyLabels[key] ?? key}
              value={copyValues[key] ?? ""}
            />
          ) : null,
        )}

        {step.shot && (
          <GuideShot step={step} imageBasePath={guide.imageBasePath} isFitted className="min-h-[200px] flex-1" />
        )}
        {renderStepExtra && (
          <div className="shrink-0">{renderStepExtra(step)}</div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 pt-1">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Voltar"
          className="max-md:size-11 max-md:shrink-0 max-md:rounded-full max-md:bg-muted max-md:px-0"
          onClick={() => goTo(safeIndex - 1)}
          disabled={safeIndex === 0}
        >
          <ArrowLeft className="size-4" /> <span className="max-md:sr-only">Voltar</span>
        </Button>
        {step.choice ? (
          <div className="flex gap-2 max-md:flex-1">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full max-md:h-11 max-md:flex-1"
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
              className="rounded-full max-md:h-11 max-md:flex-1"
              onClick={goNext}
            >
              {step.choice.noLabel} <ArrowRight className="size-4" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={goNext}
            disabled={isBlocked}
            className={cn("rounded-full max-md:h-11 max-md:flex-1", !isBlocked && isNudging && "animate-pulse ring-4 ring-primary/30")}
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
