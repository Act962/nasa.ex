import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { LoyaltyRuleError } from "@/features/star-friends/lib/redemptions";

export const starFriendsProcedure = base.use(requiredAuthMiddleware).use(requireOrgMiddleware);

export function toRuleMessage(error: unknown): string | null {
  return error instanceof LoyaltyRuleError ? error.message : null;
}
