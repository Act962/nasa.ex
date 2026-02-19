import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";

export const generateConversationSummary = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/ai/conversation/summary",
    summary: "Generate conversation summary",
    tags: ["AI"],
  });
