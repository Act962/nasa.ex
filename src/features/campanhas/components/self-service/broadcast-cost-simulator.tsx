"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  TEMPLATE_CATEGORY_LABELS,
  estimateMetaCost,
  formatBrlCents,
  type TemplateCategory,
} from "../../lib/meta-pricing";
import { quoteBroadcastFee } from "../../lib/broadcast-fee";
import { MESSAGING_LIMIT_LEVELS, planDailyBatches, resolveMessagingLimit } from "../../lib/messaging-limits";

const CATEGORIES: TemplateCategory[] = ["UTILITY", "MARKETING", "AUTHENTICATION"];

/** Simulador (spec 0040, RF-1/CA-1): custo Meta + taxa ÓRBITA + dias no limite atual. */
export function BroadcastCostSimulator({ currentLimitTier }: { currentLimitTier?: string | null }) {
  const [contacts, setContacts] = useState(1_000);
  const [openWindowPercent, setOpenWindowPercent] = useState(0);
  const [limitTier, setLimitTier] = useState(resolveMessagingLimit(currentLimitTier).tier);
  const limit = resolveMessagingLimit(limitTier);

  const rows = useMemo(
    () =>
      CATEGORIES.map((category) => {
        const metaCost = estimateMetaCost({
          recipients: contacts,
          category,
          openWindowRecipients: Math.round((contacts * openWindowPercent) / 100),
        });
        const fee = quoteBroadcastFee({ metaCostBrlCents: metaCost.totalBrlCents });
        return { category, metaCost, fee };
      }),
    [contacts, openWindowPercent],
  );
  const batches = planDailyBatches(contacts, limit);
  const marketing = rows.find((row) => row.category === "MARKETING");
  const utility = rows.find((row) => row.category === "UTILITY");
  const savings = marketing && utility ? marketing.fee.totalBrlCents - utility.fee.totalBrlCents : 0;

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="simulator-contacts">Contatos</Label>
          <Input
            id="simulator-contacts"
            type="number"
            min={1}
            value={contacts}
            onChange={(event) => setContacts(Math.max(0, Number(event.target.value) || 0))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Já conversaram nas últimas 24h: {openWindowPercent}%</Label>
          <Slider value={[openWindowPercent]} max={100} step={5} onValueChange={([value]) => setOpenWindowPercent(value)} className="pt-3" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="simulator-limit">Limite diário do número</Label>
          <select
            id="simulator-limit"
            value={limitTier}
            onChange={(event) => setLimitTier(event.target.value)}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            {MESSAGING_LIMIT_LEVELS.map((level) => (
              <option key={level.tier} value={level.tier}>
                {level.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {rows.map(({ category, metaCost, fee }) => (
          <div
            key={category}
            className={cn(
              "rounded-lg border p-3 transition-all",
              category === "UTILITY" && "border-success/50 bg-success/5 shadow-sm",
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">{TEMPLATE_CATEGORY_LABELS[category]}</p>
              {category === "UTILITY" && (
                <span className="flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-[10px] font-medium text-white">
                  <Sparkles className="size-3" /> Recomendado
                </span>
              )}
            </div>
            <dl className="space-y-1 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Meta (no seu cartão)</dt>
                <dd>{formatBrlCents(metaCost.totalBrlCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Taxa ÓRBITA ({fee.feePercent}%)</dt>
                <dd>{formatBrlCents(fee.serviceFeeBrlCents)}</dd>
              </div>
              <div className="flex justify-between border-t pt-1 text-sm font-semibold">
                <dt>Total</dt>
                <dd>{formatBrlCents(fee.totalBrlCents)}</dd>
              </div>
            </dl>
            {fee.isMinimumApplied && <p className="mt-1 text-[10px] text-muted-foreground">Taxa mínima por campanha aplicada.</p>}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        {savings > 0 && (
          <p className="text-success dark:text-success">
            Usando Utilidade você economiza <strong>{formatBrlCents(savings)}</strong> nesta campanha.
          </p>
        )}
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <CalendarDays className="size-4" />
          {batches.days <= 1
            ? "Sai toda no mesmo dia."
            : `No limite de ${limit.label}, leva ${batches.days} dias (lotes diários automáticos).`}
        </p>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Estimativa com preços de referência da Meta para o Brasil. O valor final é o da fatura da Meta.
      </p>
    </div>
  );
}
