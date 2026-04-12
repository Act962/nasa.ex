import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export const generateCampaignBrief = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      campaignType: z.string(),
      clientName: z.string().optional(),
      projectDescription: z.string().optional(),
      projectSlogan: z.string().optional(),
      projectVoiceTone: z.string().optional(),
      projectPositioning: z.string().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const brandCtx = [
      input.clientName ? `Cliente: ${input.clientName}` : "",
      input.projectDescription ? `Descrição: ${input.projectDescription}` : "",
      input.projectSlogan ? `Slogan: ${input.projectSlogan}` : "",
      input.projectPositioning ? `Posicionamento: ${input.projectPositioning}` : "",
      input.projectVoiceTone ? `Tom de voz: ${input.projectVoiceTone}` : "",
    ].filter(Boolean).join("\n");

    const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
      captacao: "Captação de Leads",
      vendas: "Vendas Diretas",
      trafego: "Tráfego Pago",
      lancamento: "Lançamento de Produto",
      retencao: "Retenção e Fidelização",
      marca: "Reconhecimento de Marca",
      educativo: "Conteúdo Educativo",
      promocao: "Promoção / Oferta",
      evento: "Evento / Webinar",
      reengajamento: "Reengajamento",
    };

    const typeLabel = CAMPAIGN_TYPE_LABELS[input.campaignType] ?? input.campaignType;

    const prompt = `Você é um estrategista de marketing digital especializado em campanhas.

CONTEXTO DA MARCA:
${brandCtx || "Nenhuma informação de marca fornecida."}

TIPO DE CAMPANHA: ${typeLabel}

Gere um briefing estratégico para essa campanha com:
1. Objetivo principal — o que queremos alcançar?
2. Contexto — por que essa campanha agora? qual dor ou oportunidade resolve?
3. Metas mensuráveis — 2 a 3 KPIs sugeridos
4. Público-alvo — quem são as pessoas a impactar?
5. Proposta de valor — qual diferencial comunicar?

Responda em português, de forma clara, direta e prática. Máximo 250 palavras. Sem markdown — use apenas quebras de linha e texto corrido.`;

    // Pollinations.ai text API — free, no API key, no tokens
    const MODELS = ["openai", "openai-large", "mistral", "mistral-large"];
    for (const model of MODELS) {
      try {
        const resp = await fetchWithTimeout(
          "https://text.pollinations.ai/openai",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: prompt }],
            }),
          },
          60000,
        );
        if (!resp.ok) continue;
        const data = await resp.json().catch(() => null);
        const txt: string | undefined = data?.choices?.[0]?.message?.content ?? (typeof data === "string" ? data : undefined);
        if (txt?.trim()) return { description: txt.trim() };
      } catch { continue; }
    }

    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Erro ao gerar briefing. O serviço gratuito (Pollinations) não respondeu. Tente novamente.",
    });
  });
