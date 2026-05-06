import { getLogs } from "./get-logs";
import { getStats } from "./get-stats";
import { heartbeat } from "./heartbeat";
import { getOnlineUsers } from "./get-online";
import { logLogout } from "./log-logout";
import { logInactivity } from "./log-inactivity";
import { getConfig } from "./get-config";
import { setConfig } from "./set-config";

export const activityRouter = {
  getLogs,
  getStats,
  heartbeat,
  getOnlineUsers,
  logLogout,
  logInactivity,
  getConfig,
  setConfig,
};
