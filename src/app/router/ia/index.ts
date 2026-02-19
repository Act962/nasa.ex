import { generateConversationSummary } from "./generate-conversation-summary";
import { getAiSettings } from "./get-ai-settings";
import { updateAiSettings } from "./update-ai-settings";

export const iaRouter = {
  compose: {
    generate: generateConversationSummary,
  },
  conversation: {
    summary: {
      generate: {},
    },
  },
  settings: {
    get: getAiSettings,
    update: updateAiSettings,
  },
};
