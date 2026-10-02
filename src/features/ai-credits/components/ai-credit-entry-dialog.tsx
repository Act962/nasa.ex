"use client";

import { useState } from "react";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ExternalLinkIcon,
  LightbulbIcon,
  ListChecksIcon,
} from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AI_CREDIT_PROVIDER_LABELS,
  type AiCreditProvider,
  type AiCreditProviderSummary,
} from "@/features/ai-credits/lib/ai-credit-types";
import { AI_CREDIT_GUIDES } from "@/features/ai-credits/lib/ai-credit-guides";
import { formatDaysLeft, formatTokens, formatUsd } from "@/features/ai-credits/lib/format-ai-credits";
import type { AiCreditEntryInput } from "@/features/ai-credits/lib/ai-credit-entry-schema";

/** Saldo do provedor no ÓRBITA: resumo do que foi informado e gasto, lançamento e passo a passo (spec 0055, RF-1 e RF-13). */

type EntryKind = AiCreditEntryInput["kind"];

const ENTRY_KINDS: Array<{ id: EntryKind; label: string; hint: string }> = [
  {
    id: "BALANCE_SNAPSHOT",
    label: "Saldo atual",
    hint: "O crédito que resta na conta agora (na OpenAI, o card “Saldo credor”; não o “gastos do mês”). Zera a conta a partir daqui.",
  },
  { id: "TOPUP", label: "Recarga", hint: "Quanto você acabou de colocar. Soma ao saldo estimado." },
  { id: "FREE_TIER", label: "Nível gratuito", hint: "Sem saldo para acabar: o ÓRBITA para de avisar saldo e segue mostrando o consumo." },
];

function PillToggle<TValue extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: TValue; label: string }>;
  value: TValue;
  onChange: (value: TValue) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-full bg-panel p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            "flex-1 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
            value === option.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SummaryFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ProviderCreditSummary({ summary }: { summary: AiCreditProviderSummary | undefined }) {
  if (!summary) return null;
  if (summary.level === "free") {
    return (
      <div className="rounded-[20px] bg-panel p-4 text-xs text-muted-foreground">
        <span className="font-semibold text-info">Nível gratuito</span> · 30 dias: {formatTokens(summary.tokens30d)} tokens
      </div>
    );
  }
  if (summary.referenceUsd === null) {
    return (
      <div className="rounded-[20px] bg-panel p-4 text-xs text-muted-foreground">
        Nenhum saldo informado ainda · 30 dias: {formatUsd(summary.spend30dUsd)} · {formatTokens(summary.tokens30d)} tokens
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-[20px] bg-panel p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryFigure label="Valor adicionado" value={formatUsd(summary.referenceUsd)} />
        <SummaryFigure label="Consumido do saldo" value={formatUsd(summary.spentSinceReferenceUsd)} />
        <SummaryFigure label="Tokens consumidos" value={formatTokens(summary.tokensSinceReference)} />
        <SummaryFigure label="Restante" value={formatUsd(summary.balanceUsd)} />
      </div>
      {summary.remainingPercent !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-knob">
          <div
            className={cn(
              "h-full rounded-full",
              summary.level === "critical" ? "bg-destructive" : summary.level === "warning" ? "bg-warning" : "bg-info",
            )}
            style={{ width: `${Math.min(100, Math.max(2, summary.remainingPercent))}%` }}
          />
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Desde {summary.lastEntryAt ? new Date(summary.lastEntryAt).toLocaleDateString("pt-BR") : "o último lançamento"} · acaba em{" "}
        {formatDaysLeft(summary.daysLeft)} no ritmo atual ({formatUsd(summary.dailyBurnUsd)}/dia)
      </p>
    </div>
  );
}

export function AiCreditEntryDialog({
  open,
  onOpenChange,
  providers,
  defaultProvider,
  summaries,
  isSaving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: readonly AiCreditProvider[];
  defaultProvider?: AiCreditProvider;
  /** Saldo e consumo atuais de cada provedor, para o resumo do topo. */
  summaries?: AiCreditProviderSummary[];
  isSaving: boolean;
  onSave: (entry: AiCreditEntryInput, onSaved: () => void) => void;
}) {
  const [provider, setProvider] = useState<AiCreditProvider>(defaultProvider ?? providers[0]);
  const [guideStepIndex, setGuideStepIndex] = useState<number | null>(null);
  const [kind, setKind] = useState<EntryKind>("BALANCE_SNAPSHOT");
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");

  const guide = AI_CREDIT_GUIDES[provider];
  const guideStep = guideStepIndex === null ? null : guide.steps[guideStepIndex];
  const availableKinds = ENTRY_KINDS.filter((entryKind) => entryKind.id !== "FREE_TIER" || guide.hasFreeTier);
  const selectedKind = availableKinds.find((entryKind) => entryKind.id === kind) ?? availableKinds[0];
  const isFreeTier = selectedKind.id === "FREE_TIER";
  const providerSummary = summaries?.find((summary) => summary.provider === provider);

  const changeProvider = (nextProvider: AiCreditProvider) => {
    setProvider(nextProvider);
    setGuideStepIndex(null);
    setKind("BALANCE_SNAPSHOT");
  };

  const handleSave = () => {
    const amountUsd = isFreeTier ? 0 : Number(amountText.replace(",", "."));
    if (!Number.isFinite(amountUsd) || amountUsd < 0) {
      toast.error("Informe um valor em dólar, por exemplo 4,17.");
      return;
    }
    onSave({ provider, kind: selectedKind.id, amountUsd, note: note.trim() || undefined }, () => {
      setAmountText("");
      setNote("");
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Informar crédito de IA</DialogTitle>
          <DialogDescription>
            Informe quanto crédito você tem (ou colocou) no provedor. O ÓRBITA desconta o consumo medido do ASTRO e mostra quanto resta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {providers.length > 1 && (
            <PillToggle
              options={providers.map((providerOption) => ({ id: providerOption, label: AI_CREDIT_PROVIDER_LABELS[providerOption] }))}
              value={provider}
              onChange={changeProvider}
            />
          )}

          <ProviderCreditSummary summary={providerSummary} />

          {guideStep && guideStepIndex !== null ? (
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-[11px] text-muted-foreground">
                  Passo a passo · {guideStepIndex + 1} de {guide.steps.length}
                </p>
                <div className="flex gap-1">
                  {guide.steps.map((step, progressIndex) => (
                    <span
                      key={step.title}
                      className={cn("h-1 flex-1 rounded-full", progressIndex <= guideStepIndex ? "bg-info" : "bg-knob")}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-3 rounded-[20px] bg-panel p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-info/15 text-xs font-semibold text-info">
                    {guideStepIndex + 1}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold">{guideStep.title}</p>
                    <p className="text-sm text-muted-foreground">{guideStep.instruction}</p>
                  </div>
                </div>
                {guideStep.link && (
                  <Button asChild className="w-full">
                    <a href={guideStep.link.href} target="_blank" rel="noopener noreferrer">
                      {guideStep.link.label}
                      <ExternalLinkIcon className="size-4" />
                    </a>
                  </Button>
                )}
                {guideStep.tip && (
                  <p className="flex items-start gap-2 rounded-[14px] bg-info/10 px-3 py-2 text-xs text-info">
                    <LightbulbIcon className="mt-0.5 size-3.5 shrink-0" />
                    {guideStep.tip}
                  </p>
                )}
                {guideStep.warning && (
                  <p className="flex items-start gap-2 rounded-[14px] border border-warning/30 bg-warning/15 px-3 py-2 text-xs text-warning">
                    <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
                    {guideStep.warning}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setGuideStepIndex(guideStepIndex === 0 ? null : guideStepIndex - 1)}
                >
                  <ArrowLeftIcon className="size-4" />
                  {guideStepIndex === 0 ? "Voltar ao saldo" : "Voltar"}
                </Button>
                {guideStepIndex < guide.steps.length - 1 ? (
                  <Button onClick={() => setGuideStepIndex(guideStepIndex + 1)}>
                    Próximo
                    <ArrowRightIcon className="size-4" />
                  </Button>
                ) : (
                  <Button onClick={() => setGuideStepIndex(null)}>Informar no ÓRBITA</Button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <PillToggle options={availableKinds} value={selectedKind.id} onChange={setKind} />
                <p className="text-xs text-muted-foreground">{selectedKind.hint}</p>
                <button
                  type="button"
                  onClick={() => setGuideStepIndex(0)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-info/10 px-3 py-1.5 text-xs font-medium text-info transition-colors hover:bg-info/15"
                >
                  <ListChecksIcon className="size-3.5" />
                  Passo a passo: como recarregar na {guide.providerLabel} e achar o saldo
                </button>
              </div>

              {!isFreeTier && (
                <div className="space-y-2">
                  <Label htmlFor="ai-credit-amount">Valor (US$)</Label>
                  <Input
                    id="ai-credit-amount"
                    inputMode="decimal"
                    placeholder="4,17"
                    value={amountText}
                    onChange={(event) => setAmountText(event.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="ai-credit-note">Observação (opcional)</Label>
                <Input
                  id="ai-credit-note"
                  placeholder="Ex.: recarga do cartão da empresa"
                  value={note}
                  maxLength={200}
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button variant="secondary" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={isSaving || (!isFreeTier && !amountText.trim())}>
                  {isSaving && <OrbitaSpinner className="size-4 " />}
                  Salvar
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
