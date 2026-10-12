"use client";

import Link from "next/link";
import { toast } from "sonner";
import { useUpdateAiPreferences } from "@/features/ia/hooks/use-ai-resources";
import { BAND_LABEL, MODEL_GUIDE_BY_ID, USE_RECOMMENDATIONS, replyCostLabel, type AiUse, type ModelBand } from "@/features/ia/lib/ai-model-guide";
import { FALLBACK_USD_TO_BRL } from "@/features/ia/lib/token-pricing";
import { cn } from "@/lib/utils";
import type { AiOverview, AiOverviewRow } from "./ai-company-panel";

// "O que cada uso roda" (spec 0093, RF-13): a faixa do modelo em vigor em cada uso, com o custo ao
// lado. Nesta etapa só mostra; a troca do atendimento continua em cada funil, e a escolha por uso num
// lugar só depende da etapa 2.

const USES: { use: AiUse; resourceId: string; label: string; hint: string; fixedNote: string }[] = [
  { use: "attendance", resourceId: "attendance.chat", label: "Atendimento ao cliente", hint: "A assistente respondendo no WhatsApp", fixedNote: "" },
  { use: "calls", resourceId: "calls.voice", label: "Ligações", hint: "A assistente atendendo por voz", fixedNote: "Cobrado por minuto. O completo custa cerca de 3 vezes mais." },
  { use: "flows", resourceId: "workflows.ai-steps", label: "Automações", hint: "Passos de IA dos Gatilhos", fixedNote: "Decisão simples, repetida muitas vezes." },
  { use: "astro", resourceId: "astro.chat", label: "Astro", hint: "O copiloto da equipe", fixedNote: "Escolhe sozinho pela dificuldade do pedido." },
];

function BandScale({ use, currentBand, isAutomatic, onChoose }: { use: AiUse; currentBand: ModelBand | null; isAutomatic: boolean; onChoose?: (band: ModelBand) => void }) {
  const bands = USE_RECOMMENDATIONS.find((recommendation) => recommendation.use === use)?.options.map((option) => option.band) ?? [];
  return (
    <div className="flex overflow-hidden rounded-full border text-xs" aria-label="Faixa do modelo em uso">
      {isAutomatic ? (
        <span className="flex-1 bg-foreground px-2 py-1.5 text-center font-semibold text-background">Automático</span>
      ) : (
        bands.map((band) => {
          const className = cn("flex-1 px-2 py-1.5 text-center text-muted-foreground", band === currentBand && "bg-foreground font-semibold text-background");
          return onChoose ? (
            <button key={band} type="button" aria-pressed={band === currentBand} onClick={() => onChoose(band)} className={cn(className, band !== currentBand && "hover:bg-muted")}>
              {BAND_LABEL[band]}
            </button>
          ) : (
            <span key={band} className={className}>
              {BAND_LABEL[band]}
            </span>
          );
        })
      )}
    </div>
  );
}

type AverageTokens = AiOverview["averageReplyTokens"]["attendance"];

function UseRow({
  use,
  label,
  hint,
  row,
  note,
  averageTokens,
  onChooseBand,
}: {
  use: AiUse;
  label: string;
  hint: string;
  row: AiOverviewRow;
  note: string;
  averageTokens: AverageTokens;
  /** Só existe quando a faixa pode ser trocada aqui: recurso na chave da empresa e quem vê pode gerenciar. */
  onChooseBand?: (band: ModelBand) => void;
}) {
  const guide = row.modelId ? MODEL_GUIDE_BY_ID.get(row.modelId) : undefined;
  const costLabel = use === "calls" || !row.modelId ? null : replyCostLabel(row.modelId, FALLBACK_USD_TO_BRL, averageTokens);
  return (
    <div className="grid items-center gap-x-4 gap-y-2 border-t py-3 text-sm first:border-t-0 md:grid-cols-[1.3fr_1.5fr_1.1fr]">
      <div className="min-w-0">
        <p className="font-medium">
          {label}
          {row.trackingName && <span className="font-normal text-muted-foreground"> · {row.trackingName}</span>}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <BandScale use={use} currentBand={guide?.band ?? null} isAutomatic={use === "astro"} onChoose={onChooseBand} />
      <div className="text-xs text-muted-foreground md:text-right">
        <p className="text-sm font-medium text-foreground">{costLabel ?? guide?.name ?? row.modelId ?? "Não roda sem chave"}</p>
        {costLabel && guide ? `${guide.name}. ` : ""}
        {costLabel ? (averageTokens ? "Pela média real da empresa. " : "Numa conversa de exemplo. ") : ""}
        {note}
        {row.trackingId && (
          <Link href={`/tracking/${row.trackingId}/settings?tab=chatbot-ia&iaTab=model`} className="ml-1 font-medium text-primary hover:underline">
            Trocar neste funil
          </Link>
        )}
      </div>
    </div>
  );
}

export function AiUseModelsCard({ overview, canManage }: { overview: AiOverview; canManage: boolean }) {
  const updatePreferences = useUpdateAiPreferences();
  const chooseFlowsBand = (band: ModelBand) =>
    updatePreferences.mutate(
      { companyKeyResources: overview.preferences.companyKeyResources, useBands: { ...overview.preferences.useBands, flows: band } },
      { onError: (error) => toast.error(`Não consegui salvar: ${error.message}`) },
    );

  return (
    <div className="border-t px-5 py-5">
      <h3 className="text-lg font-semibold">O que cada uso roda</h3>
      <p className="mb-2 text-sm text-muted-foreground">
        A faixa do modelo em vigor e quanto custa. O modelo do atendimento se troca em cada funil. O das Automações se escolhe aqui quando elas rodam na sua chave (ligue em
        &quot;Usar esta chave também em&quot;, acima); na IA da plataforma é sempre o básico.
      </p>
      {USES.flatMap(({ use, resourceId, label, hint, fixedNote }) =>
        overview.rows
          .filter((row) => row.resourceId === resourceId)
          .map((row) => (
            <UseRow
              key={`${resourceId}:${row.trackingId ?? ""}`}
              use={use}
              label={label}
              hint={hint}
              row={row}
              note={fixedNote}
              averageTokens={use === "attendance" || use === "flows" || use === "astro" ? overview.averageReplyTokens[use] : null}
              onChooseBand={use === "flows" && canManage && row.keySource === "company" && !updatePreferences.isPending ? chooseFlowsBand : undefined}
            />
          )),
      )}
    </div>
  );
}
