import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useLeadMembers(leadId: string, enabled = true) {
  return useQuery({
    ...orpc.leadMembers.list.queryOptions({ input: { leadId } }),
    enabled: enabled && Boolean(leadId),
    retry: false,
  });
}

function useInvalidateLeadMembers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.leadMembers.list.key() });
}

export function useCreateLeadMember() {
  const invalidate = useInvalidateLeadMembers();
  return useMutation(orpc.leadMembers.create.mutationOptions({ onSuccess: invalidate }));
}

export function useUpdateLeadMember() {
  const invalidate = useInvalidateLeadMembers();
  return useMutation(orpc.leadMembers.update.mutationOptions({ onSuccess: invalidate }));
}

export function useUpdateLeadMemberLabels() {
  const invalidate = useInvalidateLeadMembers();
  return useMutation(orpc.leadMembers.updateLabels.mutationOptions({ onSuccess: invalidate }));
}

export function usePromoteLeadMember() {
  const invalidate = useInvalidateLeadMembers();
  return useMutation(orpc.leadMembers.promote.mutationOptions({ onSuccess: invalidate }));
}

export function useMergeLeadAsMember() {
  const invalidate = useInvalidateLeadMembers();
  return useMutation(orpc.leadMembers.mergeLead.mutationOptions({ onSuccess: invalidate }));
}
