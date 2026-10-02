"use client";

import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useEffectiveTaxRate } from "@/features/accounting/hooks/use-accounting-pricing";
import { FiscalTermHint } from "@/features/accounting/components/shared/fiscal-term-hint";
import { formatBps } from "@/features/accounting/lib/format";

export type TaxRateSource = "PROFILE" | "MANUAL";

interface TaxRateFieldProps {
  /** Percentual digitado, como texto ("6,5" ou "6.5"). */
  taxRate: string;
  onTaxRateChange: (value: string) => void;
  source: TaxRateSource;
  onSourceChange: (source: TaxRateSource) => void;
  /** Simulação nova (ou salva sem alíquota): acompanha o perfil sozinha. */
  shouldAutoSync: boolean;
}

function bpsToPercentText(rateBps: number): string {
  return String(rateBps / 100);
}

/**
 * "Impostos (%)" do simulador. Vem da alíquota efetiva do perfil fiscal
 * (aba Contábil) quando o usuário tem acesso ao financeiro; sem acesso
 * (FORBIDDEN), vira o campo manual de sempre, sem mensagem de erro.
 */
export function TaxRateField({ taxRate, onTaxRateChange, source, onSourceChange, shouldAutoSync }: TaxRateFieldProps) {
  const effectiveRateQuery = useEffectiveTaxRate({ kind: "SERVICE" }, { silent: true });
  const profileRate = effectiveRateQuery.data;
  const isProfileAvailable = Boolean(profileRate);
  const isUsingProfile = isProfileAvailable && source === "PROFILE";
  const profileRateBps = profileRate?.rateBps ?? null;

  useEffect(() => {
    if (!shouldAutoSync || source !== "PROFILE" || profileRateBps === null) return;
    onTaxRateChange(bpsToPercentText(profileRateBps));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoSync, source, profileRateBps]);

  useEffect(() => {
    if (effectiveRateQuery.isError && source === "PROFILE") onSourceChange("MANUAL");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRateQuery.isError]);

  function handleToggle(shouldUseProfile: boolean) {
    onSourceChange(shouldUseProfile ? "PROFILE" : "MANUAL");
    if (shouldUseProfile && profileRateBps !== null) onTaxRateChange(bpsToPercentText(profileRateBps));
  }

  const typedRateBps = Math.round(Number(taxRate.replace(",", ".")) * 100);
  const isOutdated = isUsingProfile && profileRateBps !== null && Number.isFinite(typedRateBps) && typedRateBps !== profileRateBps;
  const futureRate = profileRate?.comparison.find((point) => point.year === 2027);

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1 text-xs text-muted-foreground">
        Impostos (%)
        {isProfileAvailable && <FiscalTermHint termId="aliquota-efetiva" />}
      </Label>
      <Input
        type="number"
        value={taxRate}
        onChange={(event) => {
          onTaxRateChange(event.target.value);
          if (source === "PROFILE") onSourceChange("MANUAL");
        }}
        readOnly={isUsingProfile}
        className="h-9"
      />
      {isProfileAvailable && profileRate && (
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={source === "PROFILE"} onCheckedChange={handleToggle} className="scale-75" />
            {source === "PROFILE" ? "Usando a alíquota do perfil fiscal" : "Digitando manualmente"}
          </label>
          <p className="text-[11px] text-muted-foreground">
            Hoje {formatBps(profileRate.rateBps)}
            {futureRate && ` · 2027 ${formatBps(futureRate.rateBps)}${futureRate.isEstimated ? " (estimado)" : ""}`}
          </p>
          {isOutdated && (
            <button
              type="button"
              className="text-[11px] text-info underline-offset-2 hover:underline"
              onClick={() => onTaxRateChange(bpsToPercentText(profileRate.rateBps))}
            >
              Atualizar para a alíquota de hoje ({formatBps(profileRate.rateBps)})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
