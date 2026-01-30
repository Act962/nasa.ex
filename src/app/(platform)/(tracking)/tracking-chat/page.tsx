import { ConversationsList } from "@/features/tracking-chat/components/conversations-list";
import { EmptyChat } from "@/features/tracking-chat/components/empty-chat";

export default async function Page() {
  return (
    <div className="lg:ml-80 h-full">
      <ConversationsList />
      <div className="h-full flex items-center justify-center">
        <EmptyChat
          title="Nenhuma conversa selecionada"
          description="Selecione uma conversa para começar"
        />
      </div>
    </div>
  );
}
