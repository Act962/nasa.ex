import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export function useQueryConversation(trackingId: string) {
  const { data, isLoading } = useQuery(
    orpc.conversation.list.queryOptions({
      input: {
        trackingId,
      },
    }),
  );

  return {
    data,
    isLoading,
  };
}
