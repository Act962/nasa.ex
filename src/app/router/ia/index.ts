import { createActionWithAi } from "./ai-workspace";
import { createLeadWithAi } from "./ai-tracking";
import { createAiButtonPreset } from "./create-ai-button-preset";
import { deleteAiButtonPreset } from "./delete-ai-button-preset";
import { generateCompose } from "./generate-compose";
import { generateConversationSummary } from "./generate-conversation-summary";
import { getAiSettings } from "./get-ai-settings";
import { getAiUsage } from "./get-ai-usage";
import { listAiButtonPresets } from "./list-ai-button-presets";
import { updateAiButtonPreset } from "./update-ai-button-preset";
import { updateAiSettings } from "./update-ai-settings";
import { extractBudget } from "./extract-budget";

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
  usage: {
    get: getAiUsage,
  },
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
