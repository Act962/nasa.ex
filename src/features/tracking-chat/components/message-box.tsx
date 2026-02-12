"use client";

import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Image from "next/image";
import { MarkedMessage, MessageStatus, Message } from "../types";
import { Button } from "@/components/ui/button";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { FileMessageBox } from "./file-message-box";
import { AudioMessageBox } from "./audio-message-box";
import { CheckCheckIcon, CheckIcon, LucideIcon, RedoIcon } from "lucide-react";
import { QuotedMessage } from "./quoted-message";

export function MessageBox({
  message,
  onSelectMessage,
}: {
  message: Message;
  messageSelected: MarkedMessage | undefined;
  onSelectMessage: (message: MarkedMessage) => void;
}) {
  const isOwn = message.fromMe;

  const IconStatus = IconsStatus[message.status as MessageStatus];

  const isFile =
    message.mimetype?.startsWith("application/") ||
    message.mimetype?.startsWith("text/") ||
    message.mimetype?.startsWith("image/") ||
    message.mimetype?.startsWith("video/");

  return (
    <div
      id={`message-${message.id}`}
      className={cn(
        "group flex gap-2 p-4 transition-colors duration-500",
        isOwn && "justify-end",
      )}
    >
      <div className={cn("flex relative flex-col gap-2", isOwn && "items-end")}>
        <div
          className={cn(
            "text-sm w-fit overflow-hidden space-y-2 rounded-md px-1.5",
            isOwn ? "bg-foreground/10" : "bg-accent-foreground/10",
            isFile ? "bg-transparent px-0" : "",
          )}
        >
          {message.quotedMessage && <QuotedMessage message={message} />}
          <div className="relative w-fit items-center">
            {message.mediaUrl && message.mimetype?.startsWith("image") && (
              <Image
                alt="Image"
                src={useConstructUrl(message.mediaUrl)}
                className="object-contain cursor-pointer max-h-50"
                width={288}
                height={288}
              />
            )}
            {message.mediaUrl &&
              (message.mimetype?.startsWith("application/") ||
                message.mimetype?.startsWith("text/")) && (
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
              <div className="whitespace-pre-wrap px-1.5 pt-1 ">
                {message.body}
              </div>
            )}
          </div>
          <div
            className={cn(
              "absolute top-0 -right-10 bottom-0 flex items-center w-fit",
              isOwn && "-left-10",
            )}
          >
            <Button
              variant="ghost"
              size="sm"
              className="hidden group-hover:block"
              onClick={() =>
                onSelectMessage({
                  body: message.body,
                  id: message.id,
                  messageId: message.messageId,
                  fromMe: message.fromMe,
                  quotedMessageId: message.quotedMessageId,
                  mediaUrl: message.mediaUrl,
                  mimetype: message.mimetype,
                  fileName: message.fileName,
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
