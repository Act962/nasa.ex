"use client";

import { Body } from "@/features/tracking-chat/components/body";
import { Footer } from "@/features/tracking-chat/components/footer";
import { Header } from "@/features/tracking-chat/components/header";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export default function Page() {
  const { conversationId } = useParams<{ conversationId: string }>();

  const { data, isLoading } = useQuery(
    orpc.conversation.get.queryOptions({
      input: {
        conversationId,
      },
    }),
  );

  if (isLoading || !data) {
    return <div>Loading...</div>;
  }

  return (
    <div className="lg:ml-80 h-full">
      <div className="h-full flex flex-col relative">
        <Header conversation={{ name: "Conversation" }} />
        <Body />
        <Footer
          conversationId={conversationId}
          lead={data?.conversation.lead}
        />
      </div>
    </div>
  );
}
