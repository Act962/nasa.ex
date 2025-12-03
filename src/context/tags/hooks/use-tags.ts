import { orpc } from "@/lib/orpc";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export function useTags() {
  const trackingId = useParams<{ trackingId?: string }>();
  const { data, isLoading } = useSuspenseQuery(
    orpc.tags.listTags.queryOptions({
      input: {
        query: {
          trackingId: trackingId?.trackingId,
        },
      },
    })
  );

  return {
    tags: data?.tags,
    isLoadingTags: isLoading,
  };
}
