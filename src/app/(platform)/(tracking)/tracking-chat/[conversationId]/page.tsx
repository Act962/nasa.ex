import { Body } from "@/features/tracking-chat/components/body";
import { EmptyConversation } from "@/features/tracking-chat/components/empty-conversation";
import { Footer } from "@/features/tracking-chat/components/footer";
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
    <div className="lg:ml-80 h-full">
      <div className="h-full flex flex-col relative">
        <Header conversation={{ name: "Conversation" }} />
        <Body />
        <Footer />
      </div>
    </div>
  );
}
