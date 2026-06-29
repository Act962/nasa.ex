import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { isModerator } from "../utils";

export const checkModerator = base
  .use(requiredAuthMiddleware)
  .handler(async ({ context }) => {
    const can = await isModerator(context.user.id);
    return { isModerator: can };
  });
