import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export function useTags() {
  const { data: organization } = authClient.useActiveOrganization();
  const trackingId = useParams<{ trackingId?: string }>();
  const { data, isLoading } = useQuery(
    orpc.tags.listTags.queryOptions({
      input: {
        query: {
          trackingId: trackingId?.trackingId,
        },
      },
      enabled: !!organization?.id,
    })
  );

  return {
    tags: data?.tags || [],
    isLoadingTags: isLoading,
  };
}
