import { getLogs } from "./get-logs";
import { getStats } from "./get-stats";
import { heartbeat } from "./heartbeat";
import { connect } from "./connect";
import { updateActivity } from "./update-activity";
import { getOnlineUsers } from "./get-online";
import { logLogout } from "./log-logout";
import { logInactivity } from "./log-inactivity";

export const activityRouter = {
  getLogs,
  getStats,
  heartbeat,
  connect,
  updateActivity,
  getOnlineUsers,
  logLogout,
  logInactivity,
};
