import { ConversationsLayout } from "@/features/tracking-chat/components/conversations-layout";
import { ConversationsPainel } from "@/features/tracking-chat/components/painel";

export default function Page() {
  return (
    <div>
      <ConversationsLayout>
        <ConversationsPainel />
      </ConversationsLayout>
    </div>
  );
}
