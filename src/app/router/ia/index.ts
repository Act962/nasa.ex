import { generateCompose } from "./generate-compose";
import { generateConversationSummary } from "./generate-conversation-summary";
import { getAiSettings } from "./get-ai-settings";
import { updateAiSettings } from "./update-ai-settings";

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
};
