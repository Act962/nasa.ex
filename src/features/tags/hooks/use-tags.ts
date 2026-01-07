import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export function useTags({ trackingId }: { trackingId?: string }) {

  const { data, isLoading } = useQuery(
    orpc.tags.listTags.queryOptions({
      input: {
        query: {
          trackingId,
        },
      },
    })
  );

  return {
    tags: data?.tags || [],
    isLoadingTags: isLoading,
  };
}
