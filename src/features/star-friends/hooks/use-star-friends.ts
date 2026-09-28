import { orpc } from "@/lib/orpc";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

function useInvalidateStarFriends() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.starFriends.key() });
}

export function useStarFriendsOverview() {
  return useQuery(orpc.starFriends.overview.queryOptions({ input: {} }));
}

export function useInstallStarFriends() {
  const invalidate = useInvalidateStarFriends();
  return useMutation(orpc.starFriends.install.mutationOptions({ onSuccess: invalidate }));
}

export function useUpsertStarFriendsProgram() {
  const invalidate = useInvalidateStarFriends();
  return useMutation(orpc.starFriends.upsertProgram.mutationOptions({ onSuccess: invalidate }));
}

export function useStarFriendsRewards() {
  return useQuery(orpc.starFriends.rewards.list.queryOptions({ input: {} }));
}

export function useUpsertStarFriendsReward() {
  const invalidate = useInvalidateStarFriends();
  return useMutation(orpc.starFriends.rewards.upsert.mutationOptions({ onSuccess: invalidate }));
}

export function useStarFriendsMembers(search: string) {
  return useInfiniteQuery(
    orpc.starFriends.members.list.infiniteOptions({
      input: (cursor: string | undefined) => ({ search, cursor }),
      initialPageParam: undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    }),
  );
}

export type StarFriendsHistoryFilters = {
  memberId?: string;
  actorUserId?: string;
  type?: "EARN" | "REDEEM" | "ADJUST_CREDIT" | "ADJUST_DEBIT" | "EXPIRE" | "REVERSAL";
  from?: string;
  to?: string;
};

export function useStarFriendsHistory(filters: StarFriendsHistoryFilters) {
  return useInfiniteQuery(
    orpc.starFriends.history.list.infiniteOptions({
      input: (cursor: string | undefined) => ({ ...filters, cursor }),
      initialPageParam: undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    }),
  );
}

export function useExportStarFriendsHistory() {
  return useMutation({
    mutationFn: (filters: StarFriendsHistoryFilters) =>
      orpc.starFriends.history.list.call({ ...filters, exportAll: true }),
  });
}

export function useStarFriendsRedemptions(
  status?: "PENDING" | "APPROVED" | "DELIVERED" | "REJECTED" | "CANCELED",
) {
  return useQuery(
    orpc.starFriends.redemptions.list.queryOptions({ input: { status }, refetchInterval: 30_000 }),
  );
}

export function useRequestStarFriendsRedemption() {
  const invalidate = useInvalidateStarFriends();
  return useMutation(orpc.starFriends.redemptions.request.mutationOptions({ onSuccess: invalidate }));
}

export function useDecideStarFriendsRedemption() {
  const invalidate = useInvalidateStarFriends();
  return useMutation(orpc.starFriends.redemptions.decide.mutationOptions({ onSuccess: invalidate }));
}

export function useStarFriendsByLead(leadId: string, enabled = true) {
  return useQuery(
    orpc.starFriends.byLead.queryOptions({ input: { leadId }, enabled: enabled && !!leadId }),
  );
}

export function useAdjustStarFriendsStars() {
  const invalidate = useInvalidateStarFriends();
  return useMutation(orpc.starFriends.adjust.mutationOptions({ onSuccess: invalidate }));
}

