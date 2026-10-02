"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAstroUsageSummary } from "@/features/astro/hooks/use-astro-usage-summary";
import { useAstroModelPreference } from "@/features/astro/composer/use-astro-model-preference";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ModelPricingSettingsCard } from "@/features/ai-credits/components/model-pricing-settings-card";
import { AstroUsageModelRow } from "./astro-usage-model-row";
import { AstroUsageCollapsibleSection } from "./astro-usage-collapsible";
import { ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStarsUsageBreakdown } from "@/features/stars/hooks/use-stars-purchase";
import { AstroUsageGlyph } from "@/features/ai-credits/components/astro-usage-glyph";
import { ASTRO_USAGE_TONE_COLORS, computeAstroUsageLevel } from "@/features/ai-credits/lib/astro-usage-level";
import { AI_CREDIT_PROVIDER_LABELS, type AiCreditProviderSummary } from "@/features/ai-credits/lib/ai-credit-types";
import { formatDaysLeft, formatTokens, formatUsd } from "@/features/ai-credits/lib/format-ai-credits";

/** Ícone de uso do ASTRO abaixo da caixa da Início e o painel de limites e custos (spec 0055, RF-10). */

type UsageSectionId = "model" | "stars" | "providers" | "platform";

const SOURCE_BADGES = {
  own: { label: "sua chave", className: "bg-success/15 text-success border-success/30" },
  platform: { label: "mantido pela ÓRBITA", className: "bg-info/15 text-info border-info/30" },
  none: { label: "não conectada", className: "bg-muted text-muted-foreground border-border" },
} as const;

function UsageBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="my-1.5 h-1.5 overflow-hidden rounded-full bg-knob">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(2, percent))}%`, background: color }} />
    </div>
  );
}

function creditColor(credit: AiCreditProviderSummary): string {
  if (credit.level === "critical") return ASTRO_USAGE_TONE_COLORS.limit;
  if (credit.level === "warning") return ASTRO_USAGE_TONE_COLORS.attention;
  return ASTRO_USAGE_TONE_COLORS.calm;
}

function textModelIdsOf(providerUsage: { models: Array<{ modelId: string; isVoice: boolean }> }): string[] {
  return providerUsage.models.filter((model) => !model.isVoice).map((model) => model.modelId);
}

function ModelChoicePill({
  label,
  isSelected,
  isMonospace,
  onSelect,
}: {
  label: string;
  isSelected: boolean;
  isMonospace?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={cn(
        "h-7 rounded-full px-3 text-[11.5px] font-medium transition-colors",
        isMonospace && "font-mono",
        isSelected ? "bg-foreground text-background" : "bg-knob text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function formatPerMillion(amountUsd: number | null): string {
  return amountUsd === null ? "—" : amountUsd.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function AstroUsageMeter({ className }: { className?: string }) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  // Painel aberto: consumo atualiza a cada 15 s ("em tempo real").
  const providerOrderForQuery = useAstroModelPreference((state) => state.providerOrder);
  const disabledModelIds = useAstroModelPreference((state) => state.disabledModelIds);
  const { data: usageSummary } = useAstroUsageSummary({
    refetchIntervalMs: isPanelOpen ? 15_000 : undefined,
    providerOrder: providerOrderForQuery ?? undefined,
    disabledModelIds: disabledModelIds.length > 0 ? disabledModelIds : undefined,
  });
  const { data: starsUsage } = useStarsUsageBreakdown();
  const [openedAtMs] = useState(() => Date.now());
  const preferredModelId = useAstroModelPreference((state) => state.preferredModelId);
  const providerOrder = useAstroModelPreference((state) => state.providerOrder);
  const setProviderEnabled = useAstroModelPreference((state) => state.setProviderEnabled);
  const setTextModelEnabled = useAstroModelPreference((state) => state.setTextModelEnabled);
  const activeVoiceModelId = useAstroModelPreference((state) => state.activeVoiceModelId);
  const setActiveVoiceModel = useAstroModelPreference((state) => state.setActiveVoiceModel);
  const setProviderRank = useAstroModelPreference((state) => state.setProviderRank);
  const [isPricingDialogOpen, setIsPricingDialogOpen] = useState(false);
  // Tudo nasce retraído; abrir uma seção (ou uma IA) fecha a anterior — o painel nunca estoura a tela.
  const [openSectionId, setOpenSectionId] = useState<UsageSectionId | null>(null);
  const [openProviderId, setOpenProviderId] = useState<string | null>(null);
  const toggleSection = (sectionId: UsageSectionId) =>
    setOpenSectionId((currentSectionId) => (currentSectionId === sectionId ? null : sectionId));
  const setPreferredModelId = useAstroModelPreference((state) => state.setPreferredModelId);
  if (!usageSummary) return null;

  // Chave própria: escolha livre. Chave da plataforma: só os modelos liberados pelo admin, cobrados com margem (o servidor confere de novo).
  const modelPricing = usageSummary.modelPricing ?? { markupPercent: 0, platformModelIds: [] };
  const markupPercent = modelPricing.markupPercent;
  const platformChargedModelIds = new Set(
    usageSummary.providers
      .filter((providerUsage) => providerUsage.source === "platform" && !providerUsage.isExhausted)
      .flatMap((providerUsage) => providerUsage.models.filter((model) => !model.isVoice).map((model) => model.modelId))
      .filter((modelId) => modelPricing.platformModelIds.includes(modelId)),
  );
  const selectableModelIds = new Set([
    ...usageSummary.providers
      .filter((providerUsage) => providerUsage.source === "own" && !providerUsage.isExhausted)
      .flatMap((providerUsage) => providerUsage.models.filter((model) => !model.isVoice).map((model) => model.modelId)),
    ...platformChargedModelIds,
  ]);
  for (const disabledModelId of disabledModelIds) selectableModelIds.delete(disabledModelId);
  const chosenModelId = preferredModelId && selectableModelIds.has(preferredModelId) ? preferredModelId : null;
  const displayedModelId = chosenModelId ?? usageSummary.activeModelId;
  // Ordem efetiva: a escolhida (só IAs com chave) ou, no automático, todas as disponíveis.
  const availableProviderIds = usageSummary.providers
    .filter((providerUsage) => providerUsage.source !== "none")
    .map((providerUsage) => providerUsage.provider);
  const effectiveProviderOrder = (providerOrder ?? availableProviderIds).filter((provider) => availableProviderIds.includes(provider));
  const providerSortKey = (provider: string) => {
    const rank = effectiveProviderOrder.indexOf(provider as (typeof effectiveProviderOrder)[number]);
    if (rank >= 0) return rank;
    return availableProviderIds.includes(provider as (typeof availableProviderIds)[number]) ? 10 : 20;
  };
  const orderedProviders = [...usageSummary.providers].sort(
    (left, right) => providerSortKey(left.provider) - providerSortKey(right.provider),
  );
  const modelUsageById = new Map(usageSummary.modelUsage.map((stats) => [stats.modelId, stats]));

  const usageLevel = computeAstroUsageLevel({
    aiMode: usageSummary.aiMode,
    activeProvider: usageSummary.activeProvider,
    stars: starsUsage
      ? {
          consumedInCycle: starsUsage.consumedInCycle,
          planMonthlyStars: starsUsage.planMonthlyStars,
          balance: starsUsage.balance,
          bonusBalance: starsUsage.bonusBalance,
        }
      : null,
    ownCredits: usageSummary.providers.map((providerUsage) => ({
      provider: providerUsage.provider,
      credit: providerUsage.ownCredit,
      isExhausted: providerUsage.isExhausted,
    })),
  });
  // O número ao lado do nome do modelo é o desse modelo (gasto dele ÷ crédito informado da IA), igual à barra da lista —
  // somar todos os modelos fazia o "80% · gpt-4o-mini" parecer que o mini sozinho tinha gastado 80%.
  const displayedModelProvider = usageSummary.providers.find((providerUsage) =>
    providerUsage.models.some((model) => model.modelId === displayedModelId && !model.isVoice),
  );
  const displayedModelCredit = displayedModelProvider?.source === "own" ? displayedModelProvider.ownCredit : null;
  const displayedModelPercent =
    displayedModelId && displayedModelCredit?.referenceUsd && displayedModelCredit.referenceStartAt && !displayedModelProvider?.isExhausted
      ? Math.min(100, ((modelUsageById.get(displayedModelId)?.ownKeyCostUsdSinceReference ?? 0) / displayedModelCredit.referenceUsd) * 100)
      : null;
  const ringPercent = displayedModelPercent !== null ? Math.round(displayedModelPercent * 10) / 10 : usageLevel.usedPercent;
  const ringTone =
    displayedModelPercent !== null
      ? displayedModelPercent >= 90
        ? "limit"
        : displayedModelPercent >= 75
          ? "high"
          : displayedModelPercent >= 50
            ? "attention"
            : "calm"
      : usageLevel.tone;
  const ringTitle =
    displayedModelPercent !== null && displayedModelProvider
      ? `${displayedModelId} usou ${ringPercent?.toLocaleString("pt-BR")}% do crédito informado da ${AI_CREDIT_PROVIDER_LABELS[displayedModelProvider.provider]}`
      : `Uso do ASTRO — ${usageLevel.basisLabel}`;
  const ringColor = ASTRO_USAGE_TONE_COLORS[ringTone];
  const starsPercent =
    starsUsage && starsUsage.planMonthlyStars > 0
      ? Math.min(100, Math.round((starsUsage.consumedInCycle / starsUsage.planMonthlyStars) * 100))
      : null;
  const renewsInDays = starsUsage ? Math.max(0, Math.ceil((new Date(starsUsage.cycleEnd).getTime() - openedAtMs) / 86_400_000)) : null;
  const hasOwnKey = usageSummary.providers.some((providerUsage) => providerUsage.source === "own");
  const isSystemAdmin = usageSummary.platformAccounts !== null;
  const modeLabel = usageSummary.aiMode === "OWN" ? "Sua IA" : usageSummary.aiMode === "PLATFORM" ? "Modelo ÓRBITA" : "IA não escolhida";

  return (
    <div className={cn("flex h-5 items-center gap-2 pl-3 text-[11px] text-muted-foreground", className)}>
      <Popover
        open={isPanelOpen}
        onOpenChange={setIsPanelOpen}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            title={ringTitle}
            className="flex h-5 items-center gap-1 rounded-full pr-2 pl-1 transition-colors hover:bg-foreground/5 data-[state=open]:bg-foreground/5"
          >
            <AstroUsageGlyph ringColor={ringColor} className="size-4 text-foreground" />
            <span className="font-semibold tabular-nums text-foreground">
              {ringPercent === null ? "—" : `${ringPercent.toLocaleString("pt-BR")}%`}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" side="top" className="dark w-[min(440px,calc(100vw-2rem))] space-y-0 p-4 text-foreground">
          <AstroUsageCollapsibleSection
            isFirst
            title="IA em uso"
            summary={
              <>
                <span className="font-semibold">{modeLabel}</span>
                {displayedModelId && <span className="font-mono text-[11.5px]"> · {displayedModelId}</span>}
              </>
            }
            isOpen={openSectionId === "model"}
            onToggle={() => toggleSection("model")}
          >
            <p className="text-xs">
              <span className="font-semibold">{modeLabel}</span>
              {displayedModelId && <span className="font-mono text-[11.5px]"> · {displayedModelId}</span>}
            </p>
            {selectableModelIds.size > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <ModelChoicePill label="Automático" isSelected={!chosenModelId} onSelect={() => setPreferredModelId(null)} />
                {[...selectableModelIds].map((modelId) => (
                  <ModelChoicePill
                    key={modelId}
                    label={platformChargedModelIds.has(modelId) ? `${modelId} ★` : modelId}
                    isMonospace
                    isSelected={chosenModelId === modelId}
                    onSelect={() => setPreferredModelId(modelId)}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-1 text-[11.5px] text-muted-foreground">Nenhum modelo disponível para escolha agora.</p>
            )}
            {platformChargedModelIds.size > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                ★ chave da ÓRBITA: cobrado em Stars pelo custo do modelo + {markupPercent}%.
              </p>
            )}
            {usageSummary.canManageModelPricing && (
              <button
                type="button"
                onClick={() => setIsPricingDialogOpen(true)}
                className="mt-1.5 text-[11.5px] font-medium text-info hover:underline"
              >
                Configurar preço dos modelos
              </button>
            )}
            {!chosenModelId && selectableModelIds.size > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">Automático: o ASTRO usa um modelo leve no dia a dia e um mais forte em pedidos complexos.</p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Voz:{" "}
              {activeVoiceModelId ? (
                <>
                  <span className="font-mono text-foreground">{activeVoiceModelId}</span> · {usageSummary.voice.voiceName} ·{" "}
                  {activeVoiceModelId === usageSummary.voiceOptions.standardModelId
                    ? "econômica (sem conversa ao vivo)"
                    : activeVoiceModelId === "gpt-realtime-mini"
                      ? "tempo real, ~3× mais barata"
                      : "tempo real, voz mais natural"}
                </>
              ) : (
                <span className="text-warning">desligada — o botão de conversa por voz fica escondido</span>
              )}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Ligue um modelo de voz na lista da OpenAI abaixo (um por vez).</p>
          </AstroUsageCollapsibleSection>

          {starsUsage && (
            <AstroUsageCollapsibleSection
              title="Stars do plano · ciclo atual"
              summary={`${starsUsage.consumedInCycle.toLocaleString("pt-BR")} consumidas · saldo ${starsUsage.balance.toLocaleString("pt-BR")} ★`}
              isOpen={openSectionId === "stars"}
              onToggle={() => toggleSection("stars")}
            >
              {starsPercent !== null ? (
                <>
                  <div className="flex justify-between text-xs">
                    <span>
                      {starsUsage.consumedInCycle.toLocaleString("pt-BR")} de {starsUsage.planMonthlyStars.toLocaleString("pt-BR")} consumidas
                    </span>
                    <span className="tabular-nums text-muted-foreground">{starsPercent}%</span>
                  </div>
                  <UsageBar percent={starsPercent} color={ASTRO_USAGE_TONE_COLORS[starsPercent >= 90 ? "limit" : starsPercent >= 75 ? "high" : starsPercent >= 50 ? "attention" : "calm"]} />
                </>
              ) : (
                <p className="text-xs">{starsUsage.consumedInCycle.toLocaleString("pt-BR")} consumidas no ciclo</p>
              )}
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  Saldo: {starsUsage.balance.toLocaleString("pt-BR")} ★
                  {starsUsage.bonusBalance > 0 && ` + ${starsUsage.bonusBalance.toLocaleString("pt-BR")} bônus`}
                </span>
                {renewsInDays !== null && <span>Renova em {renewsInDays} dia{renewsInDays === 1 ? "" : "s"}</span>}
              </div>
            </AstroUsageCollapsibleSection>
          )}

          <AstroUsageCollapsibleSection
            title="IAs e modelos ativos"
            summary={`${effectiveProviderOrder.length} IA${effectiveProviderOrder.length === 1 ? "" : "s"} ligada${effectiveProviderOrder.length === 1 ? "" : "s"} · principal: ${
              effectiveProviderOrder[0] ? AI_CREDIT_PROVIDER_LABELS[effectiveProviderOrder[0]] : "nenhuma"
            }`}
            isOpen={openSectionId === "providers"}
            onToggle={() => toggleSection("providers")}
          >
            <p className="mb-2 text-[11px] text-muted-foreground">
              Ligue as IAs que o ASTRO pode usar. Se a principal falhar ou ficar sem crédito, ele passa para a 2ª opção e segue a ordem de ativação.
            </p>
            <div className="space-y-2">
              {orderedProviders.map((providerUsage) => {
                const sourceBadge = SOURCE_BADGES[providerUsage.source];
                const isAvailable = providerUsage.source !== "none";
                const providerRank = effectiveProviderOrder.indexOf(providerUsage.provider);
                const isEnabled = isAvailable && providerRank >= 0;
                const isProviderOpen = openProviderId === providerUsage.provider;
                return (
                  <div
                    key={providerUsage.provider}
                    className={cn("rounded-[16px] bg-panel px-3 py-2 transition-opacity", isAvailable && !isEnabled && "opacity-55")}
                  >
                    {/* Linha da IA: nome (com o papel embaixo), liga/desliga e a seta do consumo — cabe no celular. */}
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setOpenProviderId(isProviderOpen ? null : providerUsage.provider)}
                        className="grid size-8 shrink-0 place-items-center rounded-full bg-knob text-[12px] font-bold"
                        aria-label={isProviderOpen ? "Retrair consumo" : "Ver consumo"}
                      >
                        {AI_CREDIT_PROVIDER_LABELS[providerUsage.provider].slice(0, 1)}
                      </button>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => setOpenProviderId(isProviderOpen ? null : providerUsage.provider)}
                          className={cn("block max-w-full truncate text-left text-[13px] font-semibold", !isAvailable && "text-muted-foreground")}
                          aria-expanded={isProviderOpen}
                        >
                          {AI_CREDIT_PROVIDER_LABELS[providerUsage.provider]}
                        </button>
                        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                          {isEnabled && (
                            <Select
                              value={providerRank <= 1 ? String(providerRank) : "later"}
                              onValueChange={(rankValue) => {
                                if (rankValue === "0" || rankValue === "1") {
                                  setProviderRank(providerUsage.provider, Number(rankValue) as 0 | 1, availableProviderIds);
                                }
                              }}
                            >
                              <SelectTrigger
                                size="sm"
                                className="h-6 w-auto shrink-0 gap-1 rounded-full border-line bg-knob px-2 text-[10.5px] font-semibold [&_svg]:size-3"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="dark">
                                <SelectItem value="0">Principal</SelectItem>
                                <SelectItem value="1">2ª opção</SelectItem>
                                {providerRank >= 2 && (
                                  <SelectItem value="later" disabled>
                                    {providerRank + 1}ª opção
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          )}
                          <span className={cn("truncate text-[10.5px]", providerUsage.isExhausted ? "text-destructive" : "text-muted-foreground")}>
                            {providerUsage.isExhausted ? "sem crédito" : sourceBadge.label}
                          </span>
                        </div>
                      </div>
                      {isAvailable && (
                        <Switch
                          checked={isEnabled}
                          aria-label={`${isEnabled ? "Desligar" : "Ligar"} ${AI_CREDIT_PROVIDER_LABELS[providerUsage.provider]}`}
                          onCheckedChange={(isChecked) =>
                            setProviderEnabled({
                              provider: providerUsage.provider,
                              isEnabled: isChecked,
                              providerModelIds: textModelIdsOf(providerUsage),
                              availableProviders: availableProviderIds,
                            })
                          }
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setOpenProviderId(isProviderOpen ? null : providerUsage.provider)}
                        aria-label={isProviderOpen ? "Retrair consumo" : "Ver consumo"}
                        className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-knob"
                      >
                        <ChevronDown className={cn("size-4 transition-transform duration-200", isProviderOpen && "rotate-180")} />
                      </button>
                    </div>
                    {isProviderOpen && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    {providerUsage.models.length > 0 && (
                      <ul className="mt-1.5 space-y-2">
                        {providerUsage.models.map((model) => {
                          const isActiveModel = model.isVoice ? model.modelId === activeVoiceModelId : model.modelId === displayedModelId;
                          const priceLabel =
                            platformChargedModelIds.has(model.modelId) && model.inputPerMillionUsd !== null && model.outputPerMillionUsd !== null
                              ? `US$ ${formatPerMillion(model.inputPerMillionUsd * (1 + markupPercent / 100))} / ${formatPerMillion(model.outputPerMillionUsd * (1 + markupPercent / 100))} por 1M em ★`
                              : `US$ ${formatPerMillion(model.inputPerMillionUsd)} / ${formatPerMillion(model.outputPerMillionUsd)} por 1M`;
                          return (
                            <AstroUsageModelRow
                              key={model.modelId}
                              modelId={model.modelId}
                              priceLabel={priceLabel}
                              isActive={isActiveModel}
                              isVoice={model.isVoice}
                              usage={modelUsageById.get(model.modelId)}
                              creditBasis={
                                providerUsage.source !== "own"
                                  ? { kind: "stars" }
                                  : providerUsage.ownCredit?.referenceUsd && providerUsage.ownCredit.referenceStartAt
                                    ? {
                                        kind: "own-credit",
                                        referenceUsd: providerUsage.ownCredit.referenceUsd,
                                        referenceStartAt: providerUsage.ownCredit.referenceStartAt,
                                      }
                                    : { kind: "no-credit" }
                              }
                              usdToBrlRate={usageSummary.usdToBrlRate}
                              isEnabled={model.isVoice ? model.modelId === activeVoiceModelId : !disabledModelIds.includes(model.modelId)}
                              onToggle={(isChecked) =>
                                model.isVoice
                                  ? setActiveVoiceModel(isChecked ? model.modelId : null)
                                  : setTextModelEnabled({
                                      provider: providerUsage.provider,
                                      modelId: model.modelId,
                                      isEnabled: isChecked,
                                      providerModelIds: textModelIdsOf(providerUsage),
                                      availableProviders: availableProviderIds,
                                    })
                              }
                            />
                          );
                        })}
                      </ul>
                    )}
                    {providerUsage.ownCredit && (
                      <>
                        {providerUsage.ownCredit.remainingPercent !== null && (
                          <UsageBar percent={providerUsage.ownCredit.remainingPercent} color={creditColor(providerUsage.ownCredit)} />
                        )}
                        <p className="mt-1 text-[11.5px] text-muted-foreground">
                          {providerUsage.ownCredit.balanceUsd !== null
                            ? `${formatUsd(providerUsage.ownCredit.balanceUsd)} de ${formatUsd(providerUsage.ownCredit.referenceUsd)} restantes · acaba em ${formatDaysLeft(providerUsage.ownCredit.daysLeft)} · `
                            : "Saldo não informado · "}
                          30 dias: {formatUsd(providerUsage.ownCredit.spend30dUsd)} · {formatTokens(providerUsage.ownCredit.tokens30d)} tokens
                        </p>
                      </>
                    )}
                    {providerUsage.source === "platform" && (
                      <p className="mt-1 text-[11.5px] text-muted-foreground">Cobrado em Stars · reserva automática se a sua IA ficar sem crédito</p>
                    )}
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          </AstroUsageCollapsibleSection>

          {usageSummary.platformAccounts && (
            <AstroUsageCollapsibleSection
              title={
                <>
                  Contas da plataforma <span className="font-normal text-warning">· só admin do sistema</span>
                </>
              }
              summary={`${usageSummary.platformAccounts.length} conta${usageSummary.platformAccounts.length === 1 ? "" : "s"}`}
              isOpen={openSectionId === "platform"}
              onToggle={() => toggleSection("platform")}
            >
              <div className="space-y-2">
                {usageSummary.platformAccounts.map((account) => (
                  <div key={account.provider}>
                    <div className="flex justify-between gap-3 text-xs">
                      <span>{AI_CREDIT_PROVIDER_LABELS[account.provider]}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {account.balanceUsd !== null
                          ? `${formatUsd(account.balanceUsd)} · ${Math.round(account.remainingPercent ?? 0)}% · ${formatDaysLeft(account.daysLeft)}`
                          : `saldo não informado · 30 dias ${formatUsd(account.spend30dUsd)}`}
                      </span>
                    </div>
                    {account.remainingPercent !== null && <UsageBar percent={account.remainingPercent} color={creditColor(account)} />}
                  </div>
                ))}
              </div>
            </AstroUsageCollapsibleSection>
          )}

          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <Link
              href={isSystemAdmin ? "/admin/ai-credits" : "/settings/billing"}
              className="inline-flex h-8 items-center rounded-full bg-foreground px-3.5 text-xs font-medium text-background"
            >
              Ver detalhamento
            </Link>
            {(hasOwnKey || isSystemAdmin) && (
              <Link
                href={isSystemAdmin ? "/admin/ai-credits" : "/integrations"}
                className="inline-flex h-8 items-center rounded-full bg-knob px-3.5 text-xs font-medium text-foreground"
              >
                Informar saldo
              </Link>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {usageSummary.canManageModelPricing && (
        <Dialog open={isPricingDialogOpen} onOpenChange={setIsPricingDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogTitle className="sr-only">Preço dos modelos</DialogTitle>
            {isPricingDialogOpen && <ModelPricingSettingsCard className="border-0 p-0" />}
          </DialogContent>
        </Dialog>
      )}
      {displayedModelId && (
        <>
          <span className="size-[3px] rounded-full bg-muted-foreground" aria-hidden="true" />
          <span className="font-mono">{displayedModelId}</span>
        </>
      )}
    </div>
  );
}
