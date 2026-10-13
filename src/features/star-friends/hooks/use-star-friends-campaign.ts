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

export function useDrawStarFriendsCampaign() {
  const invalidate = useInvalidateStarFriends();
  return useMutation(orpc.starFriends.campaign.draw.mutationOptions({ onSuccess: invalidate }));
}
