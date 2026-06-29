import { getUserChatPreferences } from "./get";
import { updateUserChatPreferences } from "./update";

export const userChatPreferencesRoutes = {
  get: getUserChatPreferences,
  update: updateUserChatPreferences,
};
