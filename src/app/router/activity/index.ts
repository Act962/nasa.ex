import { getLogs } from "./get-logs";
import { getStats } from "./get-stats";
import { heartbeat } from "./heartbeat";
import { getOnlineUsers } from "./get-online";
import { logLogout } from "./log-logout";

export const activityRouter = {
  getLogs,
  getStats,
  heartbeat,
  getOnlineUsers,
  logLogout,
};
