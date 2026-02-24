"use client";

import { Conversation, Lead } from "@/generated/prisma/client";
import { format } from "date-fns";
import { useParams, useRouter } from "next/navigation";
import { useCallback } from "react";
import { AvatarLead } from "./avatar-lead";
import { SelectedConversationOptions } from "./selected-conversation";
import { Instance } from "../types";
import { ChevronDownIcon } from "lucide-react";

import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ListTags } from "./list-tags";

interface ConversationWithLead extends Conversation {
  lead: Lead & {
    leadTags: {
      tag: {
        id: string;
        name: string;
        color: string | null;
        slug: string;
      };
    }[];
  };
}

interface UserBloxProps {
  item: ConversationWithLead;
  lastMessageText: string | null;
  instance?: Instance | null;
}

export function LeadBox({ item, lastMessageText, instance }: UserBloxProps) {
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
      instance={instance}
    >
      <div
        onClick={handleClick}
        className={`w-full group relative flex items-center space-x-3 p-3 hover:bg-accent-foreground/5 cursor-pointer rounded-lg transition  ${selected ? "bg-accent-foreground/5" : ""}`}
      >
        <AvatarLead Lead={item.lead} />
        <div className="min-w-0 flex-1">
          <div className="focus:outline-none">
            <div className="flex justify-between items-center mb-1 gap-x-1">
              <p className="text-sm font-medium line-clamp-2">
                {item.lead.name}
              </p>
            </div>
            {item.lead.leadTags && item.lead.leadTags.length > 0 && (
              <div className="mb-1">
                <ListTags tags={item.lead.leadTags} />
              </div>
            )}
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
        <div className="flex flex-col items-center justify-center">
          <p className="text-[10px] font-light">
            {format(new Date(item.createdAt), "dd/MM")}
          </p>
          <DropdownMenuTrigger asChild>
            <div
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <ChevronDownIcon className="size-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </DropdownMenuTrigger>
        </div>
      </div>
    </SelectedConversationOptions>
  );
}
