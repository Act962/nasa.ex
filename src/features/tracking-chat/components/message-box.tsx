"use client";

import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Image from "next/image";
import { MarkedMessage, MessageStatus, Message } from "../types";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { FileMessageBox } from "./file-message-box";
import { AudioMessageBox } from "./audio-message-box";
import { CheckCheckIcon, CheckIcon, LucideIcon, RedoIcon } from "lucide-react";

export function MessageBox({
  message,
  onSelectMessage,
}: {
  message: Message;
  messageSelected: MarkedMessage | undefined;
  onSelectMessage: (message: MarkedMessage) => void;
}) {
  const session = authClient.useSession();
  const isOwn = message.fromMe;

  const container = cn("group flex gap-2 p-4", isOwn && "justify-end");

  const body = cn("flex flex-col gap-2", isOwn && "items-end");

  const messageText = cn(
    "text-sm w-fit overflow-hidden space-y-2 rounded-md",
    isOwn ? "bg-foreground/10" : "bg-accent-foreground/10",
  );

  const iconMark = cn(
    "absolute top-0 -right-10 bottom-0 flex items-center w-fit",
    isOwn && "-left-10",
    message.mimetype && "hidden",
  );

  const name = isOwn
    ? session.data?.user.name
    : message.conversation?.lead?.name;

  const quotedName = message.quotedMessage?.fromMe
    ? session.data?.user.name
    : message.quotedMessage?.conversation?.lead?.name;

  const IconStatus = IconsStatus[message.status as MessageStatus];

  return (
    <div className={container}>
      <div className={body}>
        {message.quotedMessage && (
          <div className="flex flex-col bg-foreground/10 border-l-4 border-green-500 p-2 mb-1 rounded text-xs opacity-80 max-w-xs">
            <span className="font-bold text-green-600">{quotedName}</span>
            <span className="truncate">{message.quotedMessage.body}</span>
          </div>
        )}

        <div className="flex items-center gap-1">
          <div className="text-sm">{name}</div>
        </div>

        <div className="relative w-fit">
          <div className={messageText}>
            {message.mediaUrl && message.mimetype?.startsWith("image") && (
              <Image
                alt="Image"
                src={useConstructUrl(message.mediaUrl)}
                className="object-contain cursor-pointer hover:scale-110 transition transalate max-h-64"
                width={288}
                height={288}
              />
            )}
            {message.mediaUrl &&
              message.mimetype?.startsWith("application/pdf") && (
                <FileMessageBox
                  mediaUrl={message.mediaUrl}
                  mimetype={message.mimetype}
                  fileName={message.fileName}
                />
              )}
            {message.mediaUrl && message.mimetype?.startsWith("audio") && (
              <AudioMessageBox
                mediaUrl={message.mediaUrl}
                mimetype={message.mimetype}
              />
            )}
            {message.body && (
              <div className="whitespace-pre-wrap py-2 px-3">
                {message.body}
              </div>
            )}
          </div>
          <div className={iconMark}>
            <Button
              variant="ghost"
              size="sm"
              className="group-hover:block hidden"
              onClick={() =>
                onSelectMessage({
                  body: message.body,
                  id: message.id,
                  messageId: message.messageId,
                  fromMe: message.fromMe,
                  quotedMessageId: message.quotedMessageId,
                  lead: {
                    id: message.conversation?.lead?.id || "",
                    name: message.conversation?.lead?.name || "",
                  },
                })
              }
            >
              <RedoIcon className="size-4" />
            </Button>
          </div>
        </div>

        <div className="text-xs flex flex-row items-center gap-1">
          {format(new Date(message.createdAt), "p")}
          <IconStatus className="size-3" />
        </div>
      </div>
    </div>
  );
}

const IconsStatus: Record<MessageStatus, LucideIcon> = {
  [MessageStatus.SENT]: CheckIcon,
  [MessageStatus.SEEN]: CheckCheckIcon,
};
