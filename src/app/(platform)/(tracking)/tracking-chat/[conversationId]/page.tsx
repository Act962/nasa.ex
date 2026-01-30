"use client";

import { Spinner } from "@/components/ui/spinner";
import { Body } from "@/features/tracking-chat/components/body";
import { Footer } from "@/features/tracking-chat/components/footer";
import { Header } from "@/features/tracking-chat/components/header";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { redirect, useParams } from "next/navigation";

export default function Page() {
  const { conversationId } = useParams<{ conversationId: string }>();

  const { data, isLoading } = useQuery(
    orpc.conversation.get.queryOptions({
      input: {
        conversationId,
      },
    }),
  );

  if (isLoading) {
    return (
      <div className="lg:ml-80 h-full flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!data) {
    redirect("/tracking-chat");
  }

  return (
    <div className="lg:ml-80 h-full">
      <div className="h-full flex flex-col relative">
        <Header
          name={data.conversation.lead.name}
          profile={data.conversation.lead.profile ?? undefined}
          phone={data.conversation.lead.phone ?? undefined}
        />
        <Body />
        <Footer
          conversationId={conversationId}
          lead={data?.conversation.lead}
        />
      </div>
    </div>
  );
}
