"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, CircleQuestionMarkIcon, Map, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { orpc } from "@/lib/orpc";
import { formatBrl, formatTokens } from "@/features/ia/lib/token-pricing";
import { TokenUsageDialog } from "@/features/ia/components/token-usage-dialog";
import { useTour } from "@/features/tour/context";
import { NASA_TOUR_STEPS } from "@/features/tour/steps";

/**
 * Stars, Tokens IA, Tour Guiado e Suporte no menu do perfil.
 *
 * Antes ocupavam quatro linhas fixas no rodapé do menu lateral. Aqui
 * cada um leva ao mesmo destino de antes: Stars para o plano, Tokens
 * para o detalhamento de consumo.
 */
export function AccountMenuItems() {
  const router = useRouter();
  const { startTour } = useTour();
  const [isUsageOpen, setIsUsageOpen] = useState(false);

  const { data: balance } = useQuery({
    ...orpc.stars.getBalance.queryOptions(),
    staleTime: 30_000,
  });
  const { data: overview } = useQuery({
    ...orpc.ia.usage.overview.queryOptions(),
    staleTime: 30_000,
  });

  return (
    <>
      <DropdownMenuSeparator />

      <DropdownMenuItem
        onClick={() => router.push("/settings/billing")}
        className="cursor-pointer"
      >
        <Sparkles />
        Stars
        {balance && (
          <span className="ml-auto tabular-nums text-xs text-muted-foreground">
            {balance.balance?.toLocaleString("pt-BR") ?? "—"}
          </span>
        )}
      </DropdownMenuItem>

      <DropdownMenuItem
        onClick={() => setIsUsageOpen(true)}
        className="cursor-pointer"
      >
        <Brain />
        Tokens IA
        {overview && (
          <span className="ml-auto tabular-nums text-xs text-muted-foreground">
            {formatTokens(overview.currentCycle.totalTokens)} ·{" "}
            {formatBrl(overview.currentCycle.costBrl)}
          </span>
        )}
      </DropdownMenuItem>

      <DropdownMenuItem
        onClick={() => startTour(NASA_TOUR_STEPS)}
        className="cursor-pointer"
      >
        <Map />
        Tour Guiado
      </DropdownMenuItem>

      <DropdownMenuItem
        onClick={() => router.push("/support")}
        className="cursor-pointer"
      >
        <CircleQuestionMarkIcon />
        Suporte
      </DropdownMenuItem>

      <TokenUsageDialog open={isUsageOpen} onOpenChange={setIsUsageOpen} />
    </>
  );
}
