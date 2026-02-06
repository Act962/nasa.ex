import { EmptyChat } from "@/features/tracking-chat/components/empty-chat";

export default async function Page() {
  return (
    <div className="h-full">
      <div className="h-full items-center justify-center hidden lg:flex">
        <EmptyChat
          title="Nenhuma conversa selecionada"
          description="Selecione uma conversa para começar"
        />
      </div>
    </div>
  );
}
