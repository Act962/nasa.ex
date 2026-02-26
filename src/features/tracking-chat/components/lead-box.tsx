"use client";

import { Conversation, Lead } from "@/generated/prisma/client";
import { format, isToday, isYesterday } from "date-fns";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { AvatarLead } from "./avatar-lead";
import { SelectedConversationOptions } from "./selected-conversation";
import { colorsByTemperature, Instance } from "../types";
import { ChevronDownIcon, RocketIcon } from "lucide-react";

import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ListTags } from "./list-tags";
import { AddTagLead } from "./add-tag-lead";
import { WhatsappIcon } from "@/components/whatsapp";
import { Badge } from "@/components/ui/badge";
import { MessageTypeIcon, getMessageTypeName } from "./message-type-icon";
import { useMutationMarkReadMessage } from "../hooks/use-messages";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LeadBoxConversation extends Conversation {
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
  lastMessage?: any;
}

interface UserBloxProps {
  item: LeadBoxConversation;
  lastMessage: {
    body: string | null;
    createdAt: Date;
    mimetype?: string | null;
    fileName?: string | null;
  } | null;
  instance?: Instance | null;
  unreadCount?: number;
}

export function LeadBox({
  item,
  lastMessage,
  instance,
  unreadCount,
}: UserBloxProps) {
  const router = useRouter();
  const { conversationId } = useParams();
  const [showTagModal, setShowTagModal] = useState(false);
  const markRead = useMutationMarkReadMessage();

  const handleClick = useCallback(() => {
    router.push(`/tracking-chat/${item.id}`);
    if (unreadCount && unreadCount > 0 && instance?.token) {
      markRead.mutate({
        conversationId: item.id,
        remoteJid: item.remoteJid,
        token: instance.token,
      });
    }
  }, [router, item, unreadCount, instance, markRead]);

  const selected = item.id === conversationId;
  const hasSeen = false;

  const initialTagIds = item.lead.leadTags?.map((lt) => lt.tag?.id) || [];

  const messageBody = lastMessage?.body?.split("*")[2] || lastMessage?.body;

  return (
    <>
      <SelectedConversationOptions onOpenAddTag={() => setShowTagModal(true)}>
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

              {lastMessage && (
                <div className="flex items-center gap-1">
                  <MessageTypeIcon
                    mimetype={lastMessage.mimetype}
                    className="size-3 text-muted-foreground"
                  />
                  <p
                    className={`text-xs font-light line-clamp-1 ${
                      hasSeen ? "text-muted-foreground" : ""
                    }`}
                  >
                    {lastMessage.mimetype
                      ? getMessageTypeName(
                          lastMessage.mimetype,
                          lastMessage.fileName,
                        )
                      : messageBody}
                  </p>
                </div>
              )}
            </div>
            <div className="mb-1">
              <ListTags
                tags={item.lead.leadTags}
                onOpenAddTag={() => setShowTagModal(true)}
              />
            </div>
          </div>
          <div className="flex flex-col items-end justify-between h-full min-w-[60px] py-1">
            <p className="text-[10px] font-light">
              <FormatTime date={lastMessage?.createdAt || item.createdAt} />
            </p>
            <div className="flex items-center gap-x-1.5 h-full overflow-hidden">
              <DropdownMenuTrigger asChild>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <ChevronDownIcon className="size-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </DropdownMenuTrigger>
              {unreadCount && unreadCount >= 1 ? (
                <Badge variant={"secondary"} className="text-[9px] h-5">
                  {unreadCount}
                </Badge>
              ) : null}
            </div>
            <div className="flex items-center gap-x-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <RocketIcon
                    className="size-3"
                    style={{
                      color: colorsByTemperature[item.lead.temperature].color,
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{colorsByTemperature[item.lead.temperature].label}</p>
                </TooltipContent>
              </Tooltip>

              <WhatsappIcon className="size-3  text-green-500 mr-1" />
            </div>
          </div>
        </div>
      </SelectedConversationOptions>

      {showTagModal && instance && (
        <AddTagLead
          open={showTagModal}
          onOpenChange={setShowTagModal}
          leadId={item.lead.id}
          trackingId={item.trackingId}
          initialSelectedTagIds={initialTagIds}
          instance={instance}
        />
      )}
    </>
  );
}

function FormatTime({ date }: { date: Date }) {
  if (isToday(date)) {
    return format(date, "HH:mm");
  }
  if (isYesterday(date)) {
    return "Ontem";
  }
  return format(date, "dd/MM/yy");
}
