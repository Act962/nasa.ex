import { listAstroSessions } from "./list-sessions";
import { getAstroSession } from "./get-session";
import { deleteAstroSession } from "./delete-session";
import { createAstroSession } from "./create-session";
import { updateAstroSessionTitle } from "./update-session-title";
import { listAstroAgentConfigs } from "./list-agent-configs";
import { updateAstroAgentConfig } from "./update-agent-config";
import { searchEntities } from "@/app/router/astro/search-entities";

export const astroRoutes = {
  sessions: {
    create: createAstroSession,
    list: listAstroSessions,
    get: getAstroSession,
    delete: deleteAstroSession,
    updateTitle: updateAstroSessionTitle,
  },
  agentConfigs: {
    list: listAstroAgentConfigs,
    update: updateAstroAgentConfig,
  },
  searchEntities,
};
