"use client";

import { useState } from "react";
import { AlertTriangleIcon, BrainCircuitIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  useAddAdminAiCreditEntry,
  useAdminAiCredits,
  useRemoveAdminAiCreditEntry,
} from "@/features/ai-credits/hooks/use-ai-credits";
import {
  AI_CREDIT_PROVIDERS,
  AI_CREDIT_PROVIDER_LABELS,
  type AiCreditProvider,
  type AiCreditProviderSummary,
} from "@/features/ai-credits/lib/ai-credit-types";
import {
  AI_CREDIT_LEVEL_BADGE_CLASSES,
  AI_CREDIT_LEVEL_LABELS,
  formatDaysLeft,
  formatTokens,
  formatUsd,
} from "@/features/ai-credits/lib/format-ai-credits";
import { AiCreditEntryDialog } from "./ai-credit-entry-dialog";
import { ModelPricingSettingsCard } from "./model-pricing-settings-card";

/** Painel "Créditos de IA" do Admin: saldo estimado, ritmo e quem consome (spec 0055, RF-4). */

const LEVEL_BAR_CLASSES = {
  unknown: "bg-muted-foreground/40",
  free: "bg-info",
  ok: "bg-success",
  warning: "bg-warning",
  critical: "bg-destructive",
} as const;

function ProviderCreditCard({ summary, onInform }: { summary: AiCreditProviderSummary; onInform: () => void }) {
  const hasBalance = summary.balanceUsd !== null;
  return (
    <div className="flex flex-col gap-4 rounded-[24px] border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{AI_CREDIT_PROVIDER_LABELS[summary.provider]}</p>
          <span className={cn("mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium", AI_CREDIT_LEVEL_BADGE_CLASSES[summary.level])}>
            {AI_CREDIT_LEVEL_LABELS[summary.level]}
          </span>
        </div>
        <Button size="sm" variant="secondary" onClick={onInform}>
          <PlusIcon className="size-4" />
          Informar
        </Button>
      </div>

      <div>
        <p className="text-3xl font-bold tabular-nums">{hasBalance ? formatUsd(summary.balanceUsd) : "—"}</p>
        <p className="text-xs text-muted-foreground">
          {hasBalance ? `saldo estimado de ${formatUsd(summary.referenceUsd)}` : "Informe o saldo do painel do provedor para ver quanto resta"}
        </p>
        {summary.remainingPercent !== null && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", LEVEL_BAR_CLASSES[summary.level])}
              style={{ width: `${Math.min(100, Math.max(2, summary.remainingPercent))}%` }}
            />
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <dt className="text-muted-foreground">Acaba em</dt>
        <dd className="text-right font-medium tabular-nums">{formatDaysLeft(summary.daysLeft)}</dd>
        <dt className="text-muted-foreground">Ritmo (média 7 dias)</dt>
        <dd className="text-right font-medium tabular-nums">{formatUsd(summary.dailyBurnUsd)}/dia</dd>
        <dt className="text-muted-foreground">Hoje</dt>
        <dd className="text-right tabular-nums">{formatUsd(summary.spendTodayUsd)}</dd>
        <dt className="text-muted-foreground">7 dias</dt>
        <dd className="text-right tabular-nums">{formatUsd(summary.spend7dUsd)}</dd>
        <dt className="text-muted-foreground">30 dias</dt>
        <dd className="text-right tabular-nums">{formatUsd(summary.spend30dUsd)}</dd>
        <dt className="text-muted-foreground">Tokens (30 dias)</dt>
        <dd className="text-right tabular-nums">{formatTokens(summary.tokens30d)}</dd>
      </dl>
    </div>
  );
}

export function AdminAiCreditsPanel() {
  const { data, isLoading } = useAdminAiCredits();
  const addEntry = useAddAdminAiCreditEntry();
  const removeEntry = useRemoveAdminAiCreditEntry();
  const [dialogProvider, setDialogProvider] = useState<AiCreditProvider | null>(null);

  if (isLoading || !data) {
    return (
      <div className="grid place-items-center py-24">
        <OrbitaSpinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-full bg-info/15 text-info">
          <BrainCircuitIcon className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Créditos de IA</h1>
          <p className="text-sm text-muted-foreground">
            Saldo estimado das contas de IA da plataforma, pelo consumo medido do ASTRO, WhatsApp e Workflows. Atualize com o número do painel do provedor sempre que recarregar.
          </p>
        </div>
      </div>

      {!data.isLedgerAvailable && (
        <div className="flex items-start gap-2 rounded-[20px] border border-warning/30 bg-warning/15 p-4 text-sm text-warning">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          A tabela de lançamentos ainda não foi criada no banco (migração pendente). O consumo aparece; o saldo, só depois da migração.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {data.providers.map((summary) => (
          <ProviderCreditCard key={summary.provider} summary={summary} onInform={() => setDialogProvider(summary.provider)} />
        ))}
      </div>

      <ModelPricingSettingsCard />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-[24px] border bg-card p-5">
          <h2 className="text-sm font-semibold">Quem consumiu (30 dias)</h2>
          <p className="mb-3 text-xs text-muted-foreground">Chave da plataforma, por empresa, App e modelo. Custo estimado quando o registro não traz o valor.</p>
          {data.breakdown.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Sem consumo nos últimos 30 dias.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-3 font-medium">Empresa</th>
                    <th className="py-2 pr-3 font-medium">App</th>
                    <th className="py-2 pr-3 font-medium">Modelo</th>
                    <th className="py-2 pr-3 text-right font-medium">Tokens</th>
                    <th className="py-2 text-right font-medium">Custo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.breakdown.map((row) => (
                    <tr key={`${row.organizationId}-${row.appSlug}-${row.modelId}`} className="border-b border-line/60 last:border-0">
                      <td className="max-w-48 truncate py-2 pr-3 font-medium">{row.organizationName}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{row.appSlug}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{row.modelId}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatTokens(row.tokens)}</td>
                      <td className="py-2 text-right tabular-nums">{formatUsd(row.costUsd, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-[24px] border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Lançamentos</h2>
            <Button size="sm" variant="secondary" onClick={() => setDialogProvider("openai")} disabled={!data.isLedgerAvailable}>
              <PlusIcon className="size-4" />
              Novo
            </Button>
          </div>
          {data.entries.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Nenhum saldo ou recarga informados ainda.</p>
          ) : (
            <ul className="space-y-2">
              {data.entries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-2 rounded-[16px] bg-panel px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {entry.kind === "TOPUP" ? "Recarga" : entry.kind === "FREE_TIER" ? "Nível gratuito" : "Saldo informado"} · {AI_CREDIT_PROVIDER_LABELS[entry.provider]}
                    </p>
                    <p className="truncate text-muted-foreground">
                      {new Date(entry.effectiveAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="font-semibold tabular-nums">{formatUsd(entry.amountUsd)}</span>
                    <button
                      type="button"
                      aria-label="Remover lançamento"
                      onClick={() =>
                        removeEntry.mutate({ id: entry.id }, { onError: () => toast.error("Não consegui remover o lançamento.") })
                      }
                      className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                    >
                      <Trash2Icon className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {dialogProvider && (
        <AiCreditEntryDialog
          open
          onOpenChange={(isOpen) => !isOpen && setDialogProvider(null)}
          providers={AI_CREDIT_PROVIDERS}
          defaultProvider={dialogProvider}
          summaries={data.providers}
          isSaving={addEntry.isPending}
          onSave={(entry, onSaved) =>
            addEntry.mutate(entry, {
              onSuccess: () => {
                toast.success("Crédito registrado.");
                onSaved();
              },
              onError: () => toast.error("Não consegui registrar. A migração do banco foi aplicada?"),
            })
          }
        />
      )}
    </div>
  );
}
