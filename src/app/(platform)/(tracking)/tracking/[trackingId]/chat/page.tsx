import { EmptyChat } from "@/features/tracking-chat/components/empty-chat";

export default async function Page() {
  return (
    <div className="h-full flex-1 ">
      <div className="h-full items-center flex justify-center">
        <EmptyChat
          title="Nenhuma conversa selecionada"
          description="Selecione uma conversa para começar"
        />
      </div>
    </div>
  );
}
