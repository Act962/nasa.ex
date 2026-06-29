import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import prisma from "@/lib/prisma";
import { IntegrationPlatform } from "@/generated/prisma/enums";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedIntent {
  intent: string; // create_proposal | move_lead | generate_post | query_leads | create_lead | create_appointment | search | check_balance | create_tracking | query_data
  app: string | null; // forge | tracking | agenda | nasa-planner | null
  entities: Record<string, string>; // extracted named entities
  missingRequired: string[]; // field names that are missing but required
  estimatedStars: number; // 1-20
  summary: string; // short Portuguese summary
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é um assistente de IA do NASA Explorer que extrai intenções estruturadas de comandos em linguagem natural em português.

INTENÇÕES DISPONÍVEIS e campos:
- create_proposal → app:forge, obrigatórios: productName OU productDescription, clientName. opcionais: validUntil
- create_contract → app:forge, obrigatórios: clientName. opcionais: endDate, value
- create_lead → app:tracking, obrigatórios: leadName. opcionais: trackingName, email, phone
- move_lead → app:tracking, obrigatórios: leadName, statusName. opcionais: trackingName
- query_leads → app:tracking, opcionais: statusName, trackingName, filter, period
- create_appointment → app:agenda, obrigatórios: title. opcionais: clientName, date, time
- generate_post → app:nasa-planner, obrigatórios: topic. opcionais: postType (static/carousel/reel/story), network
- query_data → app:any, obrigatórios: subject
- search → obrigatórios: searchTerm
- check_balance → app:null
- create_tracking → app:tracking, obrigatórios: trackingName

REGRAS:
1. Identifique a intenção mais provável com base no comando.
2. Extraia todas as entidades mencionadas no comando.
3. Liste quais campos obrigatórios estão faltando em missingRequired.
4. Estime o custo em estrelas (1-20) com base na complexidade da ação.
5. Escreva um resumo curto em português do que o comando faz.
6. Retorne SOMENTE JSON válido, sem texto adicional, sem markdown, sem explicações.

FORMATO DE RESPOSTA (somente JSON puro):
{
  "intent": "nome_da_intenção",
  "app": "forge" | "tracking" | "agenda" | "nasa-planner" | null,
  "entities": { "chave": "valor" },
  "missingRequired": ["campo1", "campo2"],
  "estimatedStars": 3,
  "summary": "Resumo em português"
}`;

// ─── Helper: get connected AI integrations ────────────────────────────────────

async function getConnectedAIIntegrations(orgId: string) {
  const integrations = await prisma.platformIntegration.findMany({
    where: {
      organizationId: orgId,
      platform: { in: [IntegrationPlatform.ANTHROPIC, IntegrationPlatform.OPENAI, IntegrationPlatform.GEMINI] },
    },
  });
  return integrations;
}

// ─── Helper: parse JSON safely ────────────────────────────────────────────────

function safeParseIntent(text: string): ParsedIntent | null {
  try {
    // Strip markdown code blocks if present
    const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned) as ParsedIntent;
    if (!parsed.intent || typeof parsed.intent !== "string") return null;
    return {
      intent: parsed.intent,
      app: parsed.app ?? null,
      entities: parsed.entities ?? {},
      missingRequired: parsed.missingRequired ?? [],
      estimatedStars: typeof parsed.estimatedStars === "number" ? parsed.estimatedStars : 3,
      summary: parsed.summary ?? "",
    };
  } catch {
    return null;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function parseCommandIntent(
  command: string,
  orgId: string,
): Promise<ParsedIntent | null> {
  const integrations = await getConnectedAIIntegrations(orgId);
  if (integrations.length === 0) return null;

  const integrationMap = new Map(integrations.map((i) => [i.platform, i]));

  // ── Try Anthropic first ──
  const anthropicIntegration = integrationMap.get(IntegrationPlatform.ANTHROPIC);
  if (anthropicIntegration) {
    const apiKey = (anthropicIntegration.config as Record<string, string>)?.apiKey;
    if (apiKey) {
      try {
        const anthropic = createAnthropic({ apiKey });
        const { text } = await generateText({
          model: anthropic("claude-haiku-4-5-20251001"),
          system: SYSTEM_PROMPT,
          prompt: command,
        });
        const parsed = safeParseIntent(text);
        if (parsed) return parsed;
      } catch {
        // Try fallback model
        try {
          const apiKey2 = (anthropicIntegration.config as Record<string, string>)?.apiKey;
          if (apiKey2) {
            const anthropic2 = createAnthropic({ apiKey: apiKey2 });
            const { text: text2 } = await generateText({
              model: anthropic2("claude-3-haiku-20240307"),
              system: SYSTEM_PROMPT,
              prompt: command,
                });
            const parsed2 = safeParseIntent(text2);
            if (parsed2) return parsed2;
          }
        } catch {
          // continue to next provider
        }
      }
    }
  }

  // ── Try OpenAI ──
  const openaiIntegration = integrationMap.get(IntegrationPlatform.OPENAI);
  if (openaiIntegration) {
    const apiKey = (openaiIntegration.config as Record<string, string>)?.apiKey;
    if (apiKey) {
      try {
        const openai = createOpenAI({ apiKey });
        const { text } = await generateText({
          model: openai("gpt-4o-mini"),
          system: SYSTEM_PROMPT,
          prompt: command,
        });
        const parsed = safeParseIntent(text);
        if (parsed) return parsed;
      } catch {
        // continue to next provider
      }
    }
  }

  // ── Try Gemini ──
  const geminiIntegration = integrationMap.get(IntegrationPlatform.GEMINI);
  if (geminiIntegration) {
    const apiKey = (geminiIntegration.config as Record<string, string>)?.apiKey;
    if (apiKey) {
      try {
        const google = createGoogleGenerativeAI({ apiKey });
        const { text } = await generateText({
          model: google("gemini-2.0-flash"),
          system: SYSTEM_PROMPT,
          prompt: command,
        });
        const parsed = safeParseIntent(text);
        if (parsed) return parsed;
      } catch {
        // all providers failed
      }
    }
  }

  return null;
}
