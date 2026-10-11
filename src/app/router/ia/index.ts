import { createActionWithAi } from "./ai-workspace";
import { createLeadWithAi } from "./ai-tracking";
import { createAiButtonPreset } from "./create-ai-button-preset";
import { deleteAiButtonPreset } from "./delete-ai-button-preset";
import { generateCompose } from "./generate-compose";
import { generateConversationSummary } from "./generate-conversation-summary";
import { getAiSettings } from "./get-ai-settings";
import { getAiCapabilities, updateAiCapabilities } from "./ai-capabilities";
import { sendAttendanceTest } from "./attendance-test";
import { getAiUsage } from "./get-ai-usage";
import { getTokenUsageOverview } from "./get-token-usage-overview";
import { listAiButtonPresets } from "./list-ai-button-presets";
import { updateAiButtonPreset } from "./update-ai-button-preset";
import { updateAiSettings } from "./update-ai-settings";
import { extractBudget } from "./extract-budget";
import { getAiResourcesOverview } from "./resources-overview";
import { getAiResourceStatus } from "./resource-status";
import { getAiConsumptionReport } from "./consumption-report";
import { getAiPreferences, updateAiPreferences } from "./ai-preferences";

export const iaRouter = {
  compose: {
    generate: generateCompose,
  },
  conversation: {
    summary: {
      generate: generateConversationSummary,
    },
  },
  settings: {
    get: getAiSettings,
    update: updateAiSettings,
  },
  capabilities: {
    get: getAiCapabilities,
    update: updateAiCapabilities,
  },
  attendanceTest: {
    send: sendAttendanceTest,
  },
  usage: {
    get: getAiUsage,
    overview: getTokenUsageOverview,
  },
  // "IA da empresa" (spec 0093): modelo, chave, quem paga e uso de cada recurso.
  resourcesOverview: getAiResourcesOverview,
  // Selo de IA dos Apps: chave própria, IA básica da plataforma ou desligada.
  resourceStatus: getAiResourceStatus,
  // Relatório "Consumo de IA" do Insights: recurso × modelo × quem pagou, e o gasto por dia.
  consumptionReport: getAiConsumptionReport,
  // Em quais recursos a chave da empresa vale e a faixa do modelo por uso (etapa 2).
  preferences: { get: getAiPreferences, update: updateAiPreferences },
  buttonPresets: {
    list: listAiButtonPresets,
    create: createAiButtonPreset,
    update: updateAiButtonPreset,
    delete: deleteAiButtonPreset,
  },
  workspace: {
    chat: createActionWithAi,
  },
  tracking: {
    chat: createLeadWithAi,
  },
  extractBudget,
};
