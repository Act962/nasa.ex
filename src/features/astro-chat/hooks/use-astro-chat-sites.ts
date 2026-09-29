import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** Hooks do App ASTRO CHAT (spec 0031). */

function useInvalidateAstroChat() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.astroChat.key() });
}

export function useAstroChatSites() {
  const query = useQuery(orpc.astroChat.sites.list.queryOptions());
  return {
    sites: query.data?.sites ?? [],
    monthlyPrice: query.data?.monthlyPrice ?? 0,
    isLoading: query.isLoading,
  };
}

export function useAstroChatSetupOptions() {
  const query = useQuery(orpc.astroChat.setupOptions.queryOptions());
  return {
    trackings: query.data?.trackings ?? [],
    knowledgeBases: query.data?.knowledgeBases ?? [],
    isLoading: query.isLoading,
  };
}

export function useCreateAstroChatSite() {
  const invalidate = useInvalidateAstroChat();
  return useMutation(orpc.astroChat.sites.create.mutationOptions({ onSuccess: invalidate }));
}

export function useUpdateAstroChatSite() {
  const invalidate = useInvalidateAstroChat();
  return useMutation(orpc.astroChat.sites.update.mutationOptions({ onSuccess: invalidate }));
}

export function useDeleteAstroChatSite() {
  const invalidate = useInvalidateAstroChat();
  return useMutation(orpc.astroChat.sites.delete.mutationOptions({ onSuccess: invalidate }));
}

export function useRotateAstroChatKey() {
  const invalidate = useInvalidateAstroChat();
  return useMutation(orpc.astroChat.sites.rotateKey.mutationOptions({ onSuccess: invalidate }));
}

export function useReactivateAstroChatSite() {
  const invalidate = useInvalidateAstroChat();
  return useMutation(orpc.astroChat.sites.reactivate.mutationOptions({ onSuccess: invalidate }));
}
