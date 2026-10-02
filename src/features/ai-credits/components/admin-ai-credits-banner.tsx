"use client";

import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminAiCreditsAlertLevel } from "@/features/ai-credits/hooks/use-ai-credits";
import { AI_CREDIT_PROVIDER_LABELS } from "@/features/ai-credits/lib/ai-credit-types";
import { formatDaysLeft, formatUsd } from "@/features/ai-credits/lib/format-ai-credits";

/** Faixa no topo do Admin enquanto algum crédito de IA da plataforma está baixo (spec 0055, RF-6). */
export function AdminAiCreditsBanner() {
  const { data } = useAdminAiCreditsAlertLevel();
  if (!data || data.level === "ok") return null;
  const isCritical = data.level === "critical";
  const summaryText = data.providers
    .map((provider) => `${AI_CREDIT_PROVIDER_LABELS[provider.provider]}: ${formatUsd(provider.balanceUsd)} (acaba em ${formatDaysLeft(provider.daysLeft)})`)
    .join(" · ");
  return (
    <Link
      href="/admin/ai-credits"
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-xs font-medium md:px-6",
        isCritical ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning",
      )}
    >
      <AlertTriangleIcon className="size-4 shrink-0" />
      <span className="truncate">
        {isCritical ? "Crédito de IA quase no fim" : "Crédito de IA baixando"} — {summaryText}
      </span>
    </Link>
  );
}
