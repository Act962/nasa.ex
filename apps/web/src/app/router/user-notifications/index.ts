import { listNotifications } from "./list";
import { markNotificationRead, markAllNotificationsRead } from "./mark-read";
import {
  getNotificationPreferences,
  setNotificationPreference,
} from "./preferences";

export const userNotificationsRouter = {
  list: listNotifications,
  markRead: markNotificationRead,
  markAllRead: markAllNotificationsRead,
  getPreferences: getNotificationPreferences,
  setPreference: setNotificationPreference,
};
