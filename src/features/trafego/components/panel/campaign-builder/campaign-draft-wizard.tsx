"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";
import { emitTourResult } from "@/features/tour/store";
import {
  useCampaignAudienceSuggestion,
  useCreateCampaignDraft,
  type useCampaignBuilderContext,
} from "@/features/trafego/hooks/use-trafego-campaign-builder";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { generateDraftKey, type AudienceDraft } from "@/features/trafego/lib/campaign-builder/build-meta-payloads";
import {
  countCampaignDays,
  estimateBudgetComplement,
  isBelowMinDailyBudget,
} from "@/features/trafego/lib/campaign-builder/builder-rules";
import { AdSourcePicker, isAdSourceBlocked, toAdSourceInput, type AdSourceSelection } from "./ad-source-picker";
import { AudienceFields } from "./audience-fields";

/** Passo a passo do rascunho de campanha de WhatsApp (spec 0124, RF-3..RF-8). Tudo nasce pausado. */

type BuilderContextData = NonNullable<ReturnType<typeof useCampaignBuilderContext>["data"]>;
type WizardStep = "start" | "audience" | "ad" | "budget" | "review";

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "start", label: "Antes de começar" },
  { key: "audience", label: "Público" },
  { key: "ad", label: "Anúncio" },
  { key: "budget", label: "Verba" },
  { key: "review", label: "Revisão" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(isoDate: string, days: number): string {
  return new Date(Date.parse(`${isoDate}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function formatCalendarDate(isoDate: string): string {
  return isoDate.split("-").reverse().join("/");
}

export function CampaignDraftWizard({
  orderId,
  context,
  durationDays,
  onClose,
}: {
  orderId: string;
  context: BuilderContextData;
  durationDays: number;
  onClose: () => void;
}) {
  const createDraft = useCreateCampaignDraft();
  const { data: suggestion } = useCampaignAudienceSuggestion(orderId);
  const [draftKey] = useState(() => generateDraftKey(crypto.getRandomValues(new Uint8Array(8))));
  const [step, setStep] = useState<WizardStep>("start");
  const pagesWithWhatsapp = context.pages.filter((page) => page.whatsappNumber);
  const [pageId, setPageId] = useState<string | null>(pagesWithWhatsapp[0]?.id ?? null);
  const [chosenAudience, setAudience] = useState<AudienceDraft | null>(null);
  const [adSource, setAdSource] = useState<AdSourceSelection | null>(null);
  const [isWarningConfirmed, setIsWarningConfirmed] = useState(false);
  const [budgetBrl, setBudgetBrl] = useState(() => String(Math.max(0, context.budget.remainingBrlCents) / 100));
  const [endDate, setEndDate] = useState(() => addDays(context.today, Math.max(1, durationDays)));
  const [isComplementConfirmed, setIsComplementConfirmed] = useState(false);

  // Até a pessoa escolher, vale a sugestão do melhor conjunto antigo (RF-4).
  const audience: AudienceDraft | null =
    chosenAudience ??
    (suggestion?.audience
      ? { ...suggestion.audience, cityName: suggestion.audience.cityName ?? "Cidade do conjunto anterior" }
      : null);

  const budgetBrlCents = Math.round((Number(budgetBrl.replace(",", ".")) || 0) * 100);
  const days = countCampaignDays(context.today, endDate);
  const estimate = estimateBudgetComplement({
    budgetBrlCents,
    declaredBudgetBrlCents: context.budget.adBudgetBrlCents,
    spentBrlCents: context.budget.spentBrlCents,
  });
  const isBelowMinimum = isBelowMinDailyBudget({
    budgetBrlCents,
    days,
    minDailyBudgetCents: context.account.minDailyBudgetCents,
  });
  const isBrl = context.account.currency.toUpperCase() === "BRL";
  const page = context.pages.find((candidate) => candidate.id === pageId) ?? null;
  const pausedDrafts = context.campaigns.filter((campaign) => campaign.status !== "ACTIVE");

  const canAdvance: Record<WizardStep, boolean> = {
    start: Boolean(page?.whatsappNumber) && isBrl,
    audience: Boolean(audience),
    ad: !isAdSourceBlocked(adSource, isWarningConfirmed),
    budget:
      budgetBrlCents >= 100 &&
      endDate > context.today &&
      !isBelowMinimum &&
      (!estimate.needsConfirmation || isComplementConfirmed),
    review: true,
  };

  const stepIndex = STEPS.findIndex((item) => item.key === step);

  function handleCreate() {
    if (!pageId || !audience || !adSource) return;
    createDraft.mutate(
      {
        orderId,
        draftKey,
        pageId,
        audience,
        source: toAdSourceInput(adSource),
        budgetBrlCents,
        endDate,
        isComplementConfirmed,
        isPolicyWarningConfirmed: isWarningConfirmed,
      },
      {
        onSuccess: ({ isExisting }) => {
          toast.success(isExisting ? "Esse rascunho já estava criado." : "Rascunho criado, pausado na sua conta.");
          emitTourResult({ kind: GUIDE_RESULT_KINDS.trafegoDraftCreated });
          onClose();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="rounded-[20px] border bg-card p-4 md:p-5">
      <ol className="flex flex-wrap gap-1.5">
        {STEPS.map((item, index) => (
          <li
            key={item.key}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px]",
              index === stepIndex ? "bg-primary text-primary-foreground" : index < stepIndex ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
            )}
          >
            {index + 1}. {item.label}
          </li>
        ))}
      </ol>

      <div className="mt-5">
        {step === "start" && (
          <div className="space-y-3 text-sm">
            <p>
              Conta <strong>{context.account.name}</strong> · {context.account.currency}
            </p>
            {!isBrl && <Notice tone="danger">A conta não é em reais: a criação pelo painel só funciona em BRL.</Notice>}
            <div className="space-y-2">
              <p className="font-medium">Página que vai anunciar</p>
              {context.pages.length === 0 && (
                <Notice tone="danger">Nenhuma página anuncia por esta conta. Atribua a página no Business da Meta.</Notice>
              )}
              {context.pages.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  disabled={!candidate.whatsappNumber}
                  onClick={() => setPageId(candidate.id)}
                  className={cn(
                    "w-full rounded-[14px] border px-3 py-2 text-left text-sm disabled:opacity-60",
                    pageId === candidate.id && "border-primary bg-primary/5",
                  )}
                >
                  {candidate.name}
                  <span className="block text-xs text-muted-foreground">
                    {candidate.instagramUsername ? `@${candidate.instagramUsername}` : "Sem Instagram"} ·{" "}
                    {candidate.whatsappNumber ? `WhatsApp ${candidate.whatsappNumber}` : "Sem WhatsApp ligado: ligue nas configurações da página"}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Verba declarada {formatBrlFromCents(context.budget.adBudgetBrlCents)} · já usada{" "}
              {formatBrlFromCents(context.budget.spentBrlCents)} · saldo {formatBrlFromCents(context.budget.remainingBrlCents)}
            </p>
            {pausedDrafts.length > 0 && (
              <Notice tone="warn">
                Já há {pausedDrafts.length} rascunho(s) pausado(s) neste pedido. Confira a lista antes de criar outro.
              </Notice>
            )}
          </div>
        )}

        {step === "audience" && (
          <div className="space-y-3">
            {suggestion?.source === "history" && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="size-3.5 text-primary" />
                Sugerido pelo conjunto antigo com menor custo por conversa (
                {formatBrlFromCents(suggestion.costPerConversationCents)} por conversa).
              </p>
            )}
            <AudienceFields orderId={orderId} audience={audience} onChange={setAudience} />
          </div>
        )}

        {step === "ad" && (
          <AdSourcePicker
            orderId={orderId}
            pageId={pageId}
            images={context.images}
            copies={context.copies}
            selection={adSource}
            onChange={(selection) => {
              setAdSource(selection);
              setIsWarningConfirmed(false);
            }}
            isWarningConfirmed={isWarningConfirmed}
            onWarningConfirmedChange={setIsWarningConfirmed}
          />
        )}

        {step === "budget" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted-foreground">
                Verba total da campanha (R$)
                <Input inputMode="decimal" value={budgetBrl} onChange={(event) => setBudgetBrl(event.target.value)} className="mt-1" />
              </label>
              <label className="text-xs text-muted-foreground">
                Termina em
                <Input type="date" min={addDays(context.today, 1)} value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1" />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              {days} dia(s) · cerca de {formatBrlFromCents(Math.floor(budgetBrlCents / days))} por dia. A Meta distribui o total e não passa dele.
            </p>
            {isBelowMinimum && (
              <Notice tone="danger">
                Fica abaixo do mínimo diário da conta ({formatBrlFromCents(context.account.minDailyBudgetCents ?? 0)}). Aumente a verba ou encurte o prazo.
              </Notice>
            )}
            {estimate.needsConfirmation && (
              <label className="flex items-start gap-2 rounded-[14px] border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
                <Checkbox checked={isComplementConfirmed} onCheckedChange={(value) => setIsComplementConfirmed(value === true)} />
                A verba passa do saldo declarado em {formatBrlFromCents(estimate.excessBrlCents)}. Gasto acima do declarado gera
                complemento da taxa de cerca de {formatBrlFromCents(estimate.estimatedComplementBrlCents)}. Quero seguir.
              </label>
            )}
          </div>
        )}

        {step === "review" && audience && adSource && (
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              {adSource.previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- prévia do post ou da imagem escolhida
                <img src={adSource.previewUrl} alt="Prévia do anúncio" className="size-24 shrink-0 rounded-[14px] object-cover" />
              )}
              <p className="line-clamp-5 text-xs text-muted-foreground">{adSource.text || "Post sem legenda"}</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-muted-foreground">Objetivo</dt>
              <dd>Conversas no WhatsApp ({page?.whatsappNumber})</dd>
              <dt className="text-muted-foreground">Página</dt>
              <dd>{page?.name}</dd>
              <dt className="text-muted-foreground">Público</dt>
              <dd>
                {audience.cityName} + {audience.radiusKm} km · {audience.ageMin}–{audience.ageMax} anos ·{" "}
                {audience.gender === "all" ? "todos" : audience.gender === "female" ? "mulheres" : "homens"}
              </dd>
              <dt className="text-muted-foreground">Onde aparece</dt>
              <dd>Facebook e Instagram (feed, stories e reels)</dd>
              <dt className="text-muted-foreground">Verba total</dt>
              <dd>
                {formatBrlFromCents(budgetBrlCents)} até {formatCalendarDate(endDate)}
              </dd>
            </dl>
            <Notice tone="info">
              O rascunho nasce <strong>pausado</strong> na sua conta. Nada é gasto até você clicar em Publicar.
            </Notice>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => (stepIndex === 0 ? onClose() : setStep(STEPS[stepIndex - 1].key))}>
          <ArrowLeft className="mr-1 size-4" />
          {stepIndex === 0 ? "Cancelar" : "Voltar"}
        </Button>
        {step === "review" ? (
          <Button
            onClick={handleCreate}
            disabled={createDraft.isPending}
            data-guide={GUIDE_ANCHORS.trafegoCreateDraft.id}
            className="rounded-full"
          >
            {createDraft.isPending ? <OrbitaSpinner className="mr-1.5 size-4" /> : <CheckCircle2 className="mr-1.5 size-4" />}
            Criar rascunho
          </Button>
        ) : (
          <Button onClick={() => setStep(STEPS[stepIndex + 1].key)} disabled={!canAdvance[step]} className="rounded-full">
            Continuar
            <ArrowRight className="ml-1 size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Notice({ tone, children }: { tone: "info" | "warn" | "danger"; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-[14px] border px-3 py-2 text-xs",
        tone === "danger" && "border-destructive/40 bg-destructive/5",
        tone === "warn" && "border-warning/40 bg-warning/10",
        tone === "info" && "bg-muted/40 text-muted-foreground",
      )}
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
