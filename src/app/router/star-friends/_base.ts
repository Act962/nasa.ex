import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { LoyaltyRuleError } from "@/features/star-friends/lib/redemptions";
import { requireAppPermission } from "@/app/middlewares/app-permission";
import type { PermissionAction } from "@/features/permissions/lib/app-permission-catalog";
import { STAR_FRIENDS_APP_SLUG } from "@/features/star-friends/lib/constants";

export const starFriendsProcedure = base.use(requiredAuthMiddleware).use(requireOrgMiddleware);

export function starFriendsWith(action: PermissionAction) {
  return starFriendsProcedure.use(requireAppPermission(STAR_FRIENDS_APP_SLUG, action));
}

export function toRuleMessage(error: unknown): string | null {
  return error instanceof LoyaltyRuleError ? error.message : null;
}
