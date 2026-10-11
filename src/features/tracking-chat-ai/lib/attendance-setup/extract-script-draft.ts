import "server-only";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { z } from "zod";
import {
  GENERAL_FACTS_SYSTEM_PROMPT,
  INCONSISTENCIES_SYSTEM_PROMPT,
  SCRIPT_EXTRACTION_SYSTEM_PROMPT,
  scriptGeneralFactsSchema,
  scriptInconsistenciesSchema,
  scriptOutlineSchema,
  scriptTopicFactsSchema,
  topicFactsSystemPrompt,
  type ScriptDraft,
} from "./script-draft";

// Modelo pequeno: organizar um roteiro é copiar e separar, não raciocinar. Com o grande, cada
// montagem custava perto de US$ 0,45 (o roteiro inteiro vai em cada passada).
const EXTRACTION_MODEL_ID = "gpt-4.1-mini";
const FALLBACK_MODEL_ID = "gemini-2.5-flash";
const MAX_OUTPUT_TOKENS = 12_000;

type Usage =
  | { inputTokens?: number; outputTokens?: number; totalTokens?: number }
  | undefined;

/** Tenta o modelo principal e, se ele falhar (sem crédito, fora do ar), o reserva de outro provedor. */
async function organize<Schema extends z.ZodTypeAny>(params: {
  schema: Schema;
  system: string;
  prompt: string;
}): Promise<{ object: z.infer<Schema>; usage: Usage; modelId: string }> {
  const request = {
    schema: params.schema,
    system: params.system,
    prompt: params.prompt,
    temperature: 0.1,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  };
  try {
    const result = await generateObject({
      ...request,
      model: openai(EXTRACTION_MODEL_ID),
      maxRetries: 1,
    });
    return {
      object: result.object as z.infer<Schema>,
      usage: result.usage,
      modelId: EXTRACTION_MODEL_ID,
    };
  } catch (primaryError) {
    console.warn(
      "[attendance-script] modelo principal falhou, usando o reserva",
      primaryError instanceof Error
        ? primaryError.message.slice(0, 120)
        : "erro",
    );
    const result = await generateObject({
      ...request,
      model: google(FALLBACK_MODEL_ID),
    });
    return {
      object: result.object as z.infer<Schema>,
      usage: result.usage,
      modelId: FALLBACK_MODEL_ID,
    };
  }
}

export interface ScriptDraftExtraction {
  draft: ScriptDraft;
  modelId: string;
  tokens: { inputTokens: number; outputTokens: number; totalTokens: number };
}

function wrapScript(scriptText: string): string {
  return `Roteiro de atendimento, entre as marcas.\n\n<roteiro>\n${scriptText}\n</roteiro>`;
}

/**
 * Várias passadas sobre o mesmo roteiro: a estrutura (assistente, regras, menu); depois, em paralelo,
 * as informações gerais, a revisão de contradições e as perguntas e respostas de cada assunto.
 * Numa passada só, o modelo resumia um roteiro de várias páginas em poucas respostas e perdia quase tudo.
 *
 * O modelo só organiza: não recebe ferramenta nenhuma e nada é gravado aqui (spec 0091).
 */
export async function extractScriptDraft(
  scriptText: string,
): Promise<ScriptDraftExtraction> {
  const tokens = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  const addUsage = (usage: Usage) => {
    tokens.inputTokens += usage?.inputTokens ?? 0;
    tokens.outputTokens += usage?.outputTokens ?? 0;
    tokens.totalTokens += usage?.totalTokens ?? 0;
  };

  const outline = await organize({
    schema: scriptOutlineSchema,
    system: SCRIPT_EXTRACTION_SYSTEM_PROMPT,
    prompt: `${wrapScript(scriptText)}\n\nOrganize a estrutura do roteiro. As perguntas e respostas de cada assunto do menu serão extraídas depois: aqui registre só o que é geral.`,
  });
  addUsage(outline.usage);

  const [generalFacts, review, menuOptions] = await Promise.all([
    organize({
      schema: scriptGeneralFactsSchema,
      system: GENERAL_FACTS_SYSTEM_PROMPT,
      prompt: wrapScript(scriptText),
    }),
    organize({
      schema: scriptInconsistenciesSchema,
      system: INCONSISTENCIES_SYSTEM_PROMPT,
      prompt: wrapScript(scriptText),
    }),
    extractTopics(),
  ]);
  addUsage(generalFacts.usage);
  addUsage(review.usage);

  return {
    draft: {
      ...outline.object,
      generalFacts: generalFacts.object.facts,
      inconsistencies: review.object.inconsistencies,
      menuOptions,
    },
    modelId: outline.modelId,
    tokens,
  };

  function extractTopics() {
    return Promise.all(
      outline.object.menuOptions.map(async (option) => {
        const topicFacts = await organize({
          schema: scriptTopicFactsSchema,
          system: topicFactsSystemPrompt(option.topicName),
          prompt: `${wrapScript(scriptText)}\n\nExtraia todas as perguntas e respostas sobre: ${option.topicName}.`,
        });
        addUsage(topicFacts.usage);
        return { ...option, facts: topicFacts.object.facts };
      }),
    );
  }
}
