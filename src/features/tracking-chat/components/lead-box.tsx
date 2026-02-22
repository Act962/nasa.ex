"use client";

import { Conversation, Lead } from "@/generated/prisma/client";
import { format } from "date-fns";
import { useParams, useRouter } from "next/navigation";
import { useCallback } from "react";
import { AvatarLead } from "./avatar-lead";
import { SelectedConversationOptions } from "./selected-conversation";

interface ConversationWithLead extends Conversation {
  lead: Lead & { leadTags?: { tag: { id: string } }[] };
}

interface UserBloxProps {
  item: ConversationWithLead;
  lastMessageText: string | null;
  token?: string | null;
}

export function LeadBox({ item, lastMessageText, token }: UserBloxProps) {
  const router = useRouter();
  const { conversationId } = useParams();

  const handleClick = useCallback(() => {
    router.push(`/tracking-chat/${item.id}`);
  }, [router, item]);

  const selected = item.id === conversationId;
  const hasSeen = false;

  return (
    <SelectedConversationOptions
      lead={item.lead}
      trackingId={item.trackingId}
      token={token}
    >
      <div
        onClick={handleClick}
        className={`w-full relative flex items-center space-x-3 p-3 hover:bg-accent-foreground/5 cursor-pointer rounded-lg transition  ${selected ? "bg-accent-foreground/5" : ""}`}
      >
        <AvatarLead Lead={item.lead} />
        <div className="min-w-0 flex-1">
          <div className="focus:outline-none">
            <div className="flex justify-between items-center mb-1 gap-x-1">
              <p className="text-sm font-medium line-clamp-2">
                {item.lead.name}
              </p>
              <p className="text-xs font-light">
                {format(new Date(item.createdAt), "dd/MM/yyyy")}
              </p>
            </div>
            {lastMessageText && (
              <p
                className={`text-xs font-light ${
                  hasSeen ? "text-muted-foreground" : ""
                }`}
              >
                {lastMessageText}
              </p>
            )}
          </div>
        </div>
      </div>
    </SelectedConversationOptions>
  );
}
