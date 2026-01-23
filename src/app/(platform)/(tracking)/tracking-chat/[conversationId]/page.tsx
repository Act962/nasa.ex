import { EmptyConversation } from "@/features/tracking-chat/components/empty-conversation";
import { Header } from "@/features/tracking-chat/components/header";

interface Props {
  params: Promise<{ conversationId: string }>;
}

export default async function Page({ params }: Props) {
  const { conversationId } = await params;

  if (!conversationId) {
    return <EmptyConversation />;
  }

  return (
    <div className="lg:ml-80 h-full w-full">
      <div className="h-full flex flex-col">
        <Header conversation={{ name: "Conversation" }} />
      </div>
    </div>
  );
}
