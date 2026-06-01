/**
 * Executor WEB_SEARCH — busca real na web durante a conversa do agente.
 *
 * Estratégia em cascata pra não amarrar o user num único provider:
 *   1. Gemini Grounding (Google)    — default, free tier generoso
 *   2. OpenAI gpt-4o-mini-search    — fallback se Gemini indisponível
 *
 * Não usamos Claude `web_search` por padrão porque exige ANTHROPIC_API_KEY
 * (não configurada no projeto). Se você adicionar a chave, dá pra trocar
 * a ordem dos providers ou adicionar Claude como 2º fallback.
 *
 * Output:
 *   {
 *     summary: string,              // resposta da IA contextualizando os resultados
 *     sources: Array<{ title, url, snippet }>,
 *     provider: "gemini" | "openai",
 *     vars: { lastSearchSummary, lastSearchSources }
 *   }
 *
 * Custo: 2 ★ por busca (configurável em /admin/stars > Regras).
 */
import "server-only";
import { generateText, type ToolSet } from "ai";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { AGENT_STARS_ACTIONS } from "../agent-stars-actions";
import { interpolate } from "../workflow-context";
import type { NodeExecutor } from "../run-workflow";

type SearchSource = {
  title: string;
  url: string;
  snippet: string;
};

interface SearchResult {
  summary: string;
  sources: SearchSource[];
  provider: "gemini" | "openai";
}

// Modelos com Search Grounding na ordem de preferência. Tentamos em sequência
// porque o free tier varia por modelo na conta Google AI — alguns têm cota
// zero (gemini-2.0-flash atualmente) e outros mantêm free tier (gemini-1.5-flash).
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
];

async function searchWithGemini(query: string): Promise<SearchResult | null> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return null;

  let lastError: unknown = null;
  for (const modelId of GEMINI_MODELS) {
    try {
      const result = await generateText({
        model: google(modelId),
        tools: {
          google_search: google.tools.googleSearch({}),
        } as ToolSet,
        prompt: [
          "Pesquise informações ATUAIS na web sobre o tópico abaixo e responda de forma concisa e factual em português.",
          "Cite fontes específicas. Não invente nada.",
          "",
          `TÓPICO: ${query}`,
        ].join("\n"),
        temperature: 0,
      });

      // Gemini grounding entrega groundingMetadata em result.providerMetadata
      const grounding =
        (result.providerMetadata?.google as
          | Record<string, unknown>
          | undefined)?.groundingMetadata;

      const sources: SearchSource[] = [];
      if (grounding && typeof grounding === "object") {
        const chunks = (
          grounding as {
            groundingChunks?: Array<{
              web?: { uri?: string; title?: string };
            }>;
          }
        ).groundingChunks;
        if (Array.isArray(chunks)) {
          for (const c of chunks) {
            if (c.web?.uri) {
              sources.push({
                title: c.web.title ?? c.web.uri,
                url: c.web.uri,
                snippet: "",
              });
            }
          }
        }
      }

      return {
        summary: result.text,
        sources,
        provider: "gemini",
      };
    } catch (err) {
      // Quota / rate limit / model unavailable → tenta próximo modelo da lista
      lastError = err;
      console.warn(`[web-search:gemini] ${modelId} falhou, tentando próximo…`);
    }
  }
  if (lastError) console.warn("[web-search:gemini] todos modelos falharam", lastError);
  return null;
}

async function searchWithOpenAI(query: string): Promise<SearchResult | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    // OpenAI web search nativo é entregue via Responses API + tool
    // `webSearchPreview`. Funciona com gpt-4o e gpt-4o-mini.
    const result = await generateText({
      model: openai.responses("gpt-4o-mini"),
      tools: {
        web_search_preview: openai.tools.webSearchPreview({}),
      } as ToolSet,
      prompt: [
        "Pesquise informações ATUAIS na web sobre o tópico abaixo e responda de forma concisa e factual em português.",
        "Cite fontes específicas com URL quando possível.",
        "",
        `TÓPICO: ${query}`,
      ].join("\n"),
    });

    // Extrai citações do providerMetadata quando disponível
    const sources: SearchSource[] = [];
    const annotations =
      (result.providerMetadata?.openai as Record<string, unknown> | undefined)
        ?.annotations;
    if (Array.isArray(annotations)) {
      for (const ann of annotations) {
        const a = ann as { url?: string; title?: string };
        if (a.url) {
          sources.push({
            title: a.title ?? a.url,
            url: a.url,
            snippet: "",
          });
        }
      }
    }

    // Fallback: extrai URLs do próprio texto
    if (sources.length === 0) {
      const urlRegex = /https?:\/\/[^\s)\]}\"']+/g;
      const matches = result.text.match(urlRegex) ?? [];
      for (const url of matches.slice(0, 8)) {
        sources.push({ title: url, url, snippet: "" });
      }
    }

    return {
      summary: result.text,
      sources,
      provider: "openai",
    };
  } catch (err) {
    console.warn("[web-search:openai]", err);
    return null;
  }
}

// ─── Executor ──────────────────────────────────────
// data: { query: string, organizationId?, preferredProvider?: "gemini"|"openai" }
export const webSearchExecutor: NodeExecutor = async ({ data, context, dryRun }) => {
  const queryRaw = String(data.query ?? "");
  const query = interpolate(context, queryRaw).trim();
  const orgId = String(
    data.organizationId ?? context.trigger?.organizationId ?? "",
  );
  const preferred = String(data.preferredProvider ?? "gemini").toLowerCase();

  if (!query) {
    return {
      output: { error: "query vazia" },
      status: "FAILED",
      errorMessage: "query obrigatória",
    };
  }

  if (dryRun) {
    return {
      output: {
        dryRun: true,
        query,
        summary: "(busca simulada em dry-run)",
        sources: [],
      },
    };
  }

  // Tenta provider preferido primeiro, depois o outro como fallback
  let result: SearchResult | null = null;
  if (preferred === "openai") {
    result = await searchWithOpenAI(query);
    if (!result) result = await searchWithGemini(query);
  } else {
    result = await searchWithGemini(query);
    if (!result) result = await searchWithOpenAI(query);
  }

  if (!result) {
    return {
      output: {
        error:
          "Web search indisponível — configure GOOGLE_GENERATIVE_AI_API_KEY ou OPENAI_API_KEY no .env.local",
      },
      status: "FAILED",
      errorMessage: "no_provider_available",
    };
  }

  if (orgId) {
    await chargeStarsByAction(orgId, AGENT_STARS_ACTIONS.WEB_SEARCH, {
      description: `Web search via ${result.provider}: "${query.slice(0, 60)}"`,
      appSlug: "agent",
    }).catch((err) => console.warn("[web-search charge]", err));
  }

  return {
    output: {
      summary: result.summary,
      sources: result.sources,
      provider: result.provider,
      query,
      vars: {
        lastSearchSummary: result.summary,
        lastSearchSources: result.sources,
      },
    },
    starsSpent: 2,
  };
};
