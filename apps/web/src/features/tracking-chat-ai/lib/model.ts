import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { openai, createOpenAI } from "@ai-sdk/openai";
import type { AiProvider } from "@/generated/prisma/client";
import type { LanguageModel } from "ai";

export interface AiModelConfig {
  provider: AiProvider | null;
  modelId: string | null;
  apiKey: string | null;
}

const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-5";
const DEFAULT_GOOGLE_MODEL = "gemini-2.5-flash";

export function defaultModel(): LanguageModel {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY ausente — necessária para o agente do WhatsApp.",
    );
  }
  const id = process.env.ASTRO_DEFAULT_MODEL ?? DEFAULT_OPENAI_MODEL;
  return openai(id);
}

// Resolve qual modelo usar. Se `cfg` não tem provider+key, cai pro defaultModel
// (chave da NASA). Caso contrário, instancia o provider escolhido com a key do cliente.
export function resolveModel(cfg: AiModelConfig | null): {
  model: LanguageModel;
  usingCustom: boolean;
  provider: AiProvider | "NASA_DEFAULT";
  modelId: string;
} {
  if (!cfg?.provider || !cfg.apiKey) {
    const modelId =
      process.env.ASTRO_DEFAULT_MODEL ?? DEFAULT_OPENAI_MODEL;
    return {
      model: defaultModel(),
      usingCustom: false,
      provider: "NASA_DEFAULT",
      modelId,
    };
  }

  switch (cfg.provider) {
    case "OPENAI": {
      const modelId = cfg.modelId ?? DEFAULT_OPENAI_MODEL;
      return {
        model: createOpenAI({ apiKey: cfg.apiKey })(modelId),
        usingCustom: true,
        provider: "OPENAI",
        modelId,
      };
    }
    case "ANTHROPIC": {
      const modelId = cfg.modelId ?? DEFAULT_ANTHROPIC_MODEL;
      return {
        model: createAnthropic({ apiKey: cfg.apiKey })(modelId),
        usingCustom: true,
        provider: "ANTHROPIC",
        modelId,
      };
    }
    case "GOOGLE": {
      const modelId = cfg.modelId ?? DEFAULT_GOOGLE_MODEL;
      return {
        model: createGoogleGenerativeAI({ apiKey: cfg.apiKey })(modelId),
        usingCustom: true,
        provider: "GOOGLE",
        modelId,
      };
    }
  }
}
