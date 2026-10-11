"use client";

import { useAiResourceStatus } from "@/features/ia/hooks/use-ai-resources";
import { BAND_LABEL, EXAMPLE_REPLY_TOKENS, MODEL_GUIDE_BY_ID, replyCostLabel } from "@/features/ia/lib/ai-model-guide";
import { FALLBACK_USD_TO_BRL, PRICES_VERIFIED_ON } from "@/features/ia/lib/token-pricing";

// Explicação do modelo escolhido na aba "Modelo" do funil (spec 0093, RF-9): o que ele é, para que
// serve, o limite e quanto custa uma resposta. Para dono e admin o custo usa o tamanho médio real das
// respostas deste funil; sem histórico suficiente (ou para os demais), usa a conversa de exemplo.

export function FunnelModelHint({ modelId, trackingId }: { modelId: string | null | undefined; trackingId: string }) {
  const { data: status } = useAiResourceStatus("attendance.chat", { trackingId });
  if (!modelId) return null;

  const guide = MODEL_GUIDE_BY_ID.get(modelId);
  const averageTokens = status?.detail?.averageReplyTokens ?? null;
  const costLabel = replyCostLabel(modelId, FALLBACK_USD_TO_BRL, averageTokens);
  const basisLabel = averageTokens
    ? `média real deste funil nos últimos 30 dias (${averageTokens.sampleCalls.toLocaleString("pt-BR")} respostas, ${averageTokens.input.toLocaleString("pt-BR")} tokens de entrada)`
    : `uma conversa de exemplo (${EXAMPLE_REPLY_TOKENS.input.toLocaleString("pt-BR")} tokens de entrada)`;

  return (
    <div className="space-y-1 rounded-xl bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
      {guide ? (
        <>
          <p className="text-sm font-medium text-foreground">
            {BAND_LABEL[guide.band]} · {guide.oneLine}
          </p>
          <p>Bom para: {guide.goodFor}</p>
          <p>Limite: {guide.limit}</p>
        </>
      ) : (
        <p>Este modelo saiu da lista recomendada. Ele continua funcionando; ao trocar, ele deixa de aparecer.</p>
      )}
      {costLabel && (
        <p>
          <span className="font-medium text-foreground">Custo: {costLabel}</span>, calculado sobre {basisLabel}. Preço conferido em {PRICES_VERIFIED_ON.split("-").reverse().join("/")}.
        </p>
      )}
    </div>
  );
}
