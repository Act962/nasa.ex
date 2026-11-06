import { orpc } from "@/lib/orpc";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type CampaignReceiptFilter = "ALL" | "PENDING_REVIEW" | "ACCEPTED" | "FLAGGED" | "DUPLICATE" | "REJECTED" | "VOIDED";

function useInvalidateStarFriends() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.starFriends.key() });
}

export function useStarFriendsCampaign() {
  return useQuery(orpc.starFriends.campaign.get.queryOptions({ input: {} }));
}

export function useUpsertStarFriendsCampaign() {
  const invalidate = useInvalidateStarFriends();
  return useMutation(orpc.starFriends.campaign.upsert.mutationOptions({ onSuccess: invalidate }));
}

export function useStarFriendsCampaignReceipts(campaignId: string | undefined, filter: CampaignReceiptFilter) {
  return useInfiniteQuery(
    orpc.starFriends.campaign.receipts.infiniteOptions({
      input: (cursor: string | undefined) => ({ campaignId: campaignId ?? "", filter, cursor }),
      initialPageParam: undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      enabled: Boolean(campaignId),
    }),
  );
}

export function useExportStarFriendsCampaignNumbers() {
  return useMutation({
    mutationFn: (campaignId: string) => orpc.starFriends.campaign.exportNumbers.call({ campaignId }),
  });
}

export function useReviewStarFriendsCampaignReceipt() {
  const invalidate = useInvalidateStarFriends();
  return useMutation(orpc.starFriends.campaign.reviewReceipt.mutationOptions({ onSuccess: invalidate }));
}

export function useSweepStarFriendsCampaign() {
  const invalidate = useInvalidateStarFriends();
  return useMutation(orpc.starFriends.campaign.sweep.mutationOptions({ onSuccess: invalidate }));
}

export function useInvalidateStarFriendsCampaign() {
  return useInvalidateStarFriends();
}

/** No telão a lista só recarrega depois da revelação (`invalidateOnSuccess: false`), senão o ganhador aparece antes da animação acabar. */
export function useDrawNextStarFriendsWinner({ invalidateOnSuccess = true }: { invalidateOnSuccess?: boolean } = {}) {
  const invalidate = useInvalidateStarFriends();
  return useMutation(orpc.starFriends.campaign.drawNext.mutationOptions(invalidateOnSuccess ? { onSuccess: invalidate } : {}));
}

export function useRevokeStarFriendsDraw() {
  const invalidate = useInvalidateStarFriends();
  return useMutation(orpc.starFriends.campaign.revokeDraw.mutationOptions({ onSuccess: invalidate }));
}

export function useSetStarFriendsPrizeCount() {
  const invalidate = useInvalidateStarFriends();
  return useMutation(orpc.starFriends.campaign.setPrizeCount.mutationOptions({ onSuccess: invalidate }));
}

export function useStarFriendsCampaignParticipants(campaignId: string, search: string, enabled: boolean) {
  return useQuery(orpc.starFriends.campaign.participants.queryOptions({ input: { campaignId, search: search || undefined }, enabled }));
}

export function useAddStarFriendsManualReceipt() {
  const invalidate = useInvalidateStarFriends();
  return useMutation(orpc.starFriends.campaign.addManualReceipt.mutationOptions({ onSuccess: invalidate }));
}

export function useVoidStarFriendsReceipt() {
  const invalidate = useInvalidateStarFriends();
  return useMutation(orpc.starFriends.campaign.voidReceipt.mutationOptions({ onSuccess: invalidate }));
}

export function useStarFriendsDrawPool(campaignId: string | undefined) {
  return useQuery(
    orpc.starFriends.campaign.drawPool.queryOptions({
      input: { campaignId: campaignId ?? "" },
      enabled: Boolean(campaignId),
      staleTime: 60_000,
    }),
  );
}
