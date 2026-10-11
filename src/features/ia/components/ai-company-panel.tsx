"use client";

import { useEffect, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useAiResourcesOverview } from "@/features/ia/hooks/use-ai-resources";
import type { AiUsagePeriod } from "@/features/ia/lib/ai-use-groups";
import { cn } from "@/lib/utils";
import { AiConsumptionCard } from "./ai-consumption-card";
import { AiKeysCard, type AiKeyPlatform } from "./ai-keys-card";
import { AiModelGuide } from "./ai-model-guide";
import { AiResourceTable } from "./ai-resource-table";
import { AiUseModelsCard } from "./ai-use-models-card";

// "IA da empresa", no topo de Satélites (spec 0093): quanto a empresa gastou, qual chave está em uso
// e onde cadastrar a dela, o modelo de cada uso e a lista completa. Só dono e admin recebem os dados.

export const AI_COMPANY_SECTION_ID = "ia-da-empresa";

export type AiOverview = NonNullable<ReturnType<typeof useAiResourcesOverview>["data"]>;
export type AiOverviewRow = AiOverview["rows"][number];

function Disclosure({ label, isOpen, onToggle }: { label: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={isOpen} className="flex w-full items-center gap-2 border-t px-5 py-3 text-left text-sm font-medium hover:bg-muted/40">
      <span className="flex-1">{label}</span>
      <ChevronDownIcon className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
    </button>
  );
}

export function AiCompanyPanel({ canManage, onConnect }: { canManage: boolean; onConnect: (platform: AiKeyPlatform) => void }) {
  const [period, setPeriod] = useState<AiUsagePeriod>("month");
  const { data: overview, isLoading, isError } = useAiResourcesOverview({ period });
  const [isListOpen, setIsListOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Quem chega pelo selo ou pelo aviso vem com a âncora: a seção só existe depois que os dados carregam.
  const hasOverview = Boolean(overview);
  useEffect(() => {
    if (hasOverview && window.location.hash === `#${AI_COMPANY_SECTION_ID}`) document.getElementById(AI_COMPANY_SECTION_ID)?.scrollIntoView({ block: "start" });
  }, [hasOverview]);

  // Quem não é dono nem admin não recebe os dados: a seção simplesmente não aparece.
  if (isError) return null;
  if (isLoading || !overview) return <Skeleton className="h-40 w-full rounded-3xl" />;

  return (
    <section id={AI_COMPANY_SECTION_ID} data-guide={GUIDE_ANCHORS.integrationsAiCompany.id} className="scroll-mt-16 overflow-hidden rounded-3xl border bg-card">
      <AiConsumptionCard overview={overview} period={period} onPeriodChange={setPeriod} />
      <AiKeysCard overview={overview} canManage={canManage} onConnect={onConnect} />
      <AiUseModelsCard overview={overview} canManage={canManage} />
      <Disclosure label="Qual modelo escolher? Guia com o custo de cada um" isOpen={isGuideOpen} onToggle={() => setIsGuideOpen((wasOpen) => !wasOpen)} />
      {isGuideOpen && <AiModelGuide averageTokensByUse={overview.averageReplyTokens} />}
      <Disclosure label={`Ver a lista completa: ${overview.rows.length} recursos de IA, um por um`} isOpen={isListOpen} onToggle={() => setIsListOpen((wasOpen) => !wasOpen)} />
      {isListOpen && <AiResourceTable overview={overview} />}
    </section>
  );
}
