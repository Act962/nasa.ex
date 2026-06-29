import { getCommentsConnectionStatus } from "./get-connection-status";
import { disconnectComments } from "./disconnect";
import { commentsUserRouter } from "./user";
import { commentsAutomationsRouter } from "./automations";
import { commentsListenerRouter } from "./listener";
import { commentsTriggerRouter } from "./trigger";
import { commentsKeywordRouter } from "./keyword";
import { commentsIntegrationRouter } from "./integration";
import { commentsNotificationsRouter } from "./notifications";
import { commentsSubscriptionRouter } from "./subscription";
import { commentsSorteioRouter } from "./sorteio";
import { commentsSorteioPublicRouter } from "./sorteio-public";

export const commentsRouter = {
  getConnectionStatus: getCommentsConnectionStatus,
  disconnect: disconnectComments,
  user: commentsUserRouter,
  automations: commentsAutomationsRouter,
  listener: commentsListenerRouter,
  trigger: commentsTriggerRouter,
  keyword: commentsKeywordRouter,
  integration: commentsIntegrationRouter,
  notifications: commentsNotificationsRouter,
  subscription: commentsSubscriptionRouter,
  sorteio: commentsSorteioRouter,
  sorteioPublic: commentsSorteioPublicRouter,
};
