"use client";

import { Spinner } from "@/components/ui/spinner";
import { Body } from "@/features/tracking-chat/components/body";
import { Footer } from "@/features/tracking-chat/components/footer-chat";
import { Header } from "@/features/tracking-chat/components/header-tracking-chat";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { redirect, useParams } from "next/navigation";
import { useState } from "react";

import { MarkedMessage } from "@/features/tracking-chat/types";

export default function Page() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [messageSelected, setMessageSelected] = useState<
    MarkedMessage | undefined
  >(undefined);
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
    <div className="h-full relative">
      {/* Layer 1: pattern WhatsApp Web (JPG q=70, ~178KB).
          bg-fixed mantém parado durante scroll. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 pointer-events-none",
          "bg-[url('/chat-bg/mobile.jpg')] md:bg-[url('/chat-bg/desktop.jpg')]",
          "bg-cover bg-center bg-fixed",
          "bg-[#dbe9f7] dark:bg-zinc-900",
        )}
      />
      {/* Layer 2: overlay translúcida que dilui o pattern.
          Ajuste o `/55` (light) e `/40` (dark) entre 0 e 100 pra mais
          ou menos destaque. Maior = pattern mais apagado. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none bg-background/60 dark:bg-background/40"
      />
      {/* Layer 3: conteúdo. */}
      <div className="relative h-full flex flex-col">
        <Header
          name={data.conversation.lead?.name || ""}
          profile={data.conversation.lead?.profile ?? undefined}
          phone={data.conversation.lead?.phone ?? undefined}
          leadId={data.conversation.lead.id}
          conversationId={conversationId}
          active={data.conversation.lead.isActive}
          trackingId={data.conversation.trackingId}
          statusFlow={data.conversation.lead.statusFlow}
          channel={data.conversation.channel}
          trackingName={(data.conversation as any).tracking?.name ?? null}
          statusName={(data.conversation.lead as any).status?.name ?? null}
        />
        <Body
          messageSelected={messageSelected}
          onSelectMessage={setMessageSelected}
          trackingId={data.conversation.trackingId}
          isGroup={data.conversation.isGroup}
        />
        <Footer
          messageSelected={messageSelected}
          closeMessageSelected={() => setMessageSelected(undefined)}
          trackingId={data.conversation.tracking.id}
          conversationId={conversationId}
          lead={data?.conversation.lead}
        />
      </div>
    </div>
  );
}
