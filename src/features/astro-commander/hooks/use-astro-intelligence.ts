import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** Auto Inteligência do ASTRO (spec 0028, RF-13 a RF-16). */

function useInvalidateIntelligence() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: orpc.astroCommander.intelligence.key() });
}

export function useAstroKnowledge() {
  const query = useQuery(orpc.astroCommander.intelligence.knowledge.list.queryOptions());
  return {
    documents: query.data?.documents ?? [],
    totalChars: query.data?.totalChars ?? 0,
    limits: query.data?.limits ?? { perDocument: 20_000, total: 60_000 },
    isLoading: query.isLoading,
  };
}

export function useAstroKnowledgeDocument(knowledgeId: string | null) {
  const query = useQuery({
    ...orpc.astroCommander.intelligence.knowledge.get.queryOptions({
      input: { knowledgeId: knowledgeId ?? "" },
    }),
    enabled: Boolean(knowledgeId),
  });
  return { document: query.data ?? null, isLoading: query.isLoading };
}

export function useSaveAstroKnowledge() {
  const invalidate = useInvalidateIntelligence();
  return useMutation(
    orpc.astroCommander.intelligence.knowledge.save.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useDeleteAstroKnowledge() {
  const invalidate = useInvalidateIntelligence();
  return useMutation(
    orpc.astroCommander.intelligence.knowledge.delete.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useAstroMemories() {
  const query = useQuery(orpc.astroCommander.intelligence.memories.list.queryOptions({ input: {} }));
  return {
    memories: query.data?.memories ?? [],
    suggestedCount: query.data?.suggestedCount ?? 0,
    activeCount: query.data?.activeCount ?? 0,
    isLoading: query.isLoading,
  };
}

export function useCreateAstroMemory() {
  const invalidate = useInvalidateIntelligence();
  return useMutation(
    orpc.astroCommander.intelligence.memories.create.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useSetAstroMemoryStatus() {
  const invalidate = useInvalidateIntelligence();
  return useMutation(
    orpc.astroCommander.intelligence.memories.setStatus.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useDeleteAstroMemory() {
  const invalidate = useInvalidateIntelligence();
  return useMutation(
    orpc.astroCommander.intelligence.memories.delete.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useAstroFeedback() {
  const query = useQuery(
    orpc.astroCommander.intelligence.feedback.list.queryOptions({ input: { limit: 20 } }),
  );
  return { feedbacks: query.data?.feedbacks ?? [], isLoading: query.isLoading };
}

export function useSendAstroFeedback() {
  const invalidate = useInvalidateIntelligence();
  return useMutation(
    orpc.astroCommander.intelligence.feedback.send.mutationOptions({ onSuccess: invalidate }),
  );
}
