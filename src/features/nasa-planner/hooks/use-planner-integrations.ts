"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Fase 2 do Planner: Comments por post (spec 0059) e disparo de WhatsApp (spec 0060). */

function useInvalidatePlanner() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.nasaPlanner.key() });
}

export function usePlannerPostComments(postId: string | null) {
  const { data, isLoading } = useQuery({
    ...orpc.nasaPlanner.comments.get.queryOptions({ input: { postId: postId ?? "" } }),
    enabled: Boolean(postId),
  });
  return { commentsStatus: data ?? null, isLoading };
}

export function useSavePlannerPostComments() {
  const invalidatePlanner = useInvalidatePlanner();
  const queryClient = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.comments.save.mutationOptions({
      onSuccess: () => {
        invalidatePlanner();
        void queryClient.invalidateQueries({ queryKey: orpc.comments.key() });
      },
    }),
  );
}

export function usePlannerCalendarBroadcasts(range: { organizationIds?: string[]; from: Date; to: Date }) {
  const { data } = useQuery(orpc.nasaPlanner.calendar.broadcasts.queryOptions({ input: range }));
  return { broadcasts: data?.broadcasts ?? [] };
}

export function usePlannerBroadcastTemplates(organizationId: string | null, trackingId: string | null) {
  const { data, isLoading, error } = useQuery({
    ...orpc.nasaPlanner.broadcasts.templates.queryOptions({ input: { organizationId: organizationId ?? "", trackingId: trackingId ?? "" } }),
    enabled: Boolean(organizationId && trackingId),
    retry: false,
  });
  return { templates: data?.templates ?? [], isLoading, error };
}

export function useCreatePlannerBroadcast() {
  const invalidatePlanner = useInvalidatePlanner();
  const queryClient = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.broadcasts.createScheduled.mutationOptions({
      onSuccess: () => {
        invalidatePlanner();
        void queryClient.invalidateQueries({ queryKey: orpc.campanhas.key() });
      },
    }),
  );
}
