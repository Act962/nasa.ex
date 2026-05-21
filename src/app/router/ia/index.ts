import { createActionWithAi } from "./ai-workspace";
import { createLeadWithAi } from "./ai-tracking";
import { generateCompose } from "./generate-compose";
import { generateConversationSummary } from "./generate-conversation-summary";
import { getAiSettings } from "./get-ai-settings";
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
  workspace: {
    chat: createActionWithAi,
  },
  tracking: {
    chat: createLeadWithAi,
  },
  extractBudget,
};
