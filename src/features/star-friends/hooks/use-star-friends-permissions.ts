import { useCheckPermission } from "@/hooks/use-check-permission";
import { STAR_FRIENDS_APP_SLUG } from "../lib/constants";

// Espelho no cliente da matriz de Permissões — só esconde botões; quem
// bloqueia de fato é o servidor (requireAppPermission).
export function useStarFriendsPermissions() {
  const { checkPermission, isLoading } = useCheckPermission();
  return {
    isLoading,
    canView: checkPermission(STAR_FRIENDS_APP_SLUG, "canView"),
    canRedeemAndCredit: checkPermission(STAR_FRIENDS_APP_SLUG, "canCreate"),
    canConfigure: checkPermission(STAR_FRIENDS_APP_SLUG, "canEdit"),
    canDebitAndCancel: checkPermission(STAR_FRIENDS_APP_SLUG, "canDelete"),
    canApproveRedemptions: checkPermission(STAR_FRIENDS_APP_SLUG, "canApprove"),
  };
}
