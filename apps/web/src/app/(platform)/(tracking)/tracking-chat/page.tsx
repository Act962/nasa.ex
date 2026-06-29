import { EmptyChat } from "@/features/tracking-chat/components/empty-chat";
import { AppPinnedInsightsStrip } from "@/components/app-pinned-insights-strip";

export default async function Page() {
  return (
    <div className="h-full flex-1 flex flex-col">
      <AppPinnedInsightsStrip appModule="chat" />
      <div className="h-full items-center flex justify-center flex-1">
        <EmptyChat
          title="Nenhuma conversa selecionada"
          description="Selecione uma conversa para começar"
        />
      </div>
    </div>
  );
}
