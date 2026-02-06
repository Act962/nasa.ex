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
      <div className=" h-full flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!data) {
    redirect("/tracking-chat");
  }

  return (
    <div className=" h-full">
      <div className="h-full flex flex-col relative">
        <Header
          name={data.conversation.lead?.name || ""}
          profile={data.conversation.lead?.profile ?? undefined}
          phone={data.conversation.lead?.phone ?? undefined}
          leadId={data.conversation.lead.id}
        />
        <Body />
        <Footer
          trackingId={data.conversation.tracking.id}
          conversationId={conversationId}
          lead={data?.conversation.lead}
        />
      </div>
    </div>
  );
}
