"use client";

import { useState } from "react";
import { WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAddOrganizationAiCreditEntry } from "@/features/ai-credits/hooks/use-ai-credits";
import type { AiCreditProviderSummary } from "@/features/ai-credits/lib/ai-credit-types";
import {
  AI_CREDIT_LEVEL_BADGE_CLASSES,
  AI_CREDIT_LEVEL_LABELS,
  formatDaysLeft,
  formatTokens,
  formatUsd,
} from "@/features/ai-credits/lib/format-ai-credits";
import { AiCreditEntryDialog } from "./ai-credit-entry-dialog";

/** Consumo e saldo estimado da chave de IA própria, no card do satélite (spec 0055, RF-9). */
export function OrganizationAiCreditStrip({ summary, canManage }: { summary: AiCreditProviderSummary; canManage: boolean }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const addEntry = useAddOrganizationAiCreditEntry();
  const hasBalance = summary.balanceUsd !== null;

  return (
    <div className="space-y-2 rounded-[16px] bg-panel px-3 py-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">30 dias</span>
        <span className="font-medium tabular-nums">
          {formatTokens(summary.tokens30d)} tokens · ~{formatUsd(summary.spend30dUsd)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        {hasBalance ? (
          <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium", AI_CREDIT_LEVEL_BADGE_CLASSES[summary.level])}>
            {formatUsd(summary.balanceUsd)} · acaba em {formatDaysLeft(summary.daysLeft)}
          </span>
        ) : summary.level === "free" ? (
          <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium", AI_CREDIT_LEVEL_BADGE_CLASSES.free)}>
            {AI_CREDIT_LEVEL_LABELS.free}
          </span>
        ) : (
          <span className="text-muted-foreground">{AI_CREDIT_LEVEL_LABELS.unknown}</span>
        )}
        {canManage && (
          <button
            type="button"
            onClick={() => setIsDialogOpen(true)}
            className="inline-flex shrink-0 items-center gap-1 font-medium text-info hover:underline"
          >
            <WalletIcon className="size-3.5" />
            Informar saldo
          </button>
        )}
      </div>
      {isDialogOpen && (
        <AiCreditEntryDialog
          open
          onOpenChange={setIsDialogOpen}
          providers={[summary.provider]}
          defaultProvider={summary.provider}
          summaries={[summary]}
          isSaving={addEntry.isPending}
          onSave={(entry, onSaved) =>
            addEntry.mutate(entry, {
              onSuccess: () => {
                toast.success("Saldo registrado. Vamos avisar antes de acabar.");
                onSaved();
              },
              onError: () => toast.error("Não consegui registrar o saldo agora."),
            })
          }
        />
      )}
    </div>
  );
}
