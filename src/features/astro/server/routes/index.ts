import { listAstroSessions } from "./list-sessions";
import { getAstroSession } from "./get-session";
import { deleteAstroSession } from "./delete-session";
import { listAstroAgentConfigs } from "./list-agent-configs";
import { updateAstroAgentConfig } from "./update-agent-config";

export const astroRoutes = {
  sessions: {
    list: listAstroSessions,
    get: getAstroSession,
    delete: deleteAstroSession,
  },
  agentConfigs: {
    list: listAstroAgentConfigs,
    update: updateAstroAgentConfig,
  },
};
