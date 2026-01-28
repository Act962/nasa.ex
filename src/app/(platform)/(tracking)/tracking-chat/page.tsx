import { ConversationsList } from "@/features/tracking-chat/components/conversations-list";
import { prefetchLeadsByWhats } from "@/features/tracking-chat/server/prefetch";
import { getQueryClient, HydrateClient } from "@/lib/query/hydration";

export default async function Page() {
  const queryClient = getQueryClient();
  await prefetchLeadsByWhats(queryClient);
  return (
    <HydrateClient client={queryClient}>
      <ConversationsList />
    </HydrateClient>
  );
}
