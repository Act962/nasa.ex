import { listAstroSessions } from "./list-sessions";
import { getAstroSession } from "./get-session";
import { deleteAstroSession } from "./delete-session";
import { createAstroSession } from "./create-session";
import { updateAstroSessionTitle } from "./update-session-title";
import { appendAstroVoiceTurns } from "./append-voice-turns";
import { listAstroAgentConfigs } from "./list-agent-configs";
import { updateAstroAgentConfig } from "./update-agent-config";
import { getAstroAiMode, setAstroAiMode } from "./ai-mode";
import { getAstroUsageSummary } from "./usage-summary";
import { getAstroModelPricing, setAstroModelPricing } from "./model-pricing";
import { searchEntities } from "@/app/router/astro/search-entities";

export const astroRoutes = {
  sessions: {
    create: createAstroSession,
    list: listAstroSessions,
    get: getAstroSession,
    delete: deleteAstroSession,
    updateTitle: updateAstroSessionTitle,
    appendVoiceTurns: appendAstroVoiceTurns,
  },
  agentConfigs: {
    list: listAstroAgentConfigs,
    update: updateAstroAgentConfig,
  },
  aiMode: {
    get: getAstroAiMode,
    set: setAstroAiMode,
  },
  usageSummary: getAstroUsageSummary,
  modelPricing: {
    get: getAstroModelPricing,
    set: setAstroModelPricing,
  },
  searchEntities,
};
