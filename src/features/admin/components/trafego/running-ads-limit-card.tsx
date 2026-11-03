"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { resolveIncludedAds } from "@/features/trafego/lib/creative-limits";
import { useSetTrafegoRunningAdsLimit } from "@/features/trafego/hooks/use-trafego-admin";

/** Anúncios no ar ao mesmo tempo (spec 0127): a faixa da verba é o padrão; acima disso, extra cobrado. */
export function RunningAdsLimitCard({
  orderId,
  maxRunningAds,
  adBudgetBrlCents,
}: {
  orderId: string;
  maxRunningAds: number;
  adBudgetBrlCents: number;
}) {
  const [value, setValue] = useState(String(maxRunningAds));
  const setLimit = useSetTrafegoRunningAdsLimit();
  const includedAds = resolveIncludedAds(adBudgetBrlCents);
  const parsedValue = Number(value);
  const isValid = Number.isInteger(parsedValue) && parsedValue >= 1 && parsedValue <= 50;

  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Anúncios ao mesmo tempo</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        A verba de {formatBrlFromCents(adBudgetBrlCents)} inclui {includedAds}. Libere mais só depois de cobrar o
        extra.
      </p>
      <div className="mt-3 flex gap-2">
        <Input
          type="number"
          min={1}
          max={50}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="w-24"
        />
        <Button
          size="sm"
          disabled={!isValid || parsedValue === maxRunningAds || setLimit.isPending}
          onClick={() =>
            setLimit.mutate(
              { orderId, maxRunningAds: parsedValue },
              {
                onSuccess: () => toast.success("Limite atualizado."),
                onError: (error) => toast.error(error.message),
              },
            )
          }
        >
          Salvar
        </Button>
      </div>
    </div>
  );
}
