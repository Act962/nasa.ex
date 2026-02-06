"use client";

import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Image from "next/image";
import { Message, MessageStatus } from "../types";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { FileMessageBox } from "./file-message-box";
import { AudioMessageBox } from "./audio-message-box";
import { CheckCheckIcon, CheckIcon, LucideIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function MessageBox({ message }: { message: Message }) {
  const session = authClient.useSession();
  const isOwn = message.fromMe;

  const container = cn("flex gap-2 p-4", isOwn && "justify-end");

  const body = cn("flex flex-col gap-2", isOwn && "items-end");

  const messageText = cn(
    "text-sm w-fit overflow-hidden space-y-2",
    isOwn ? "bg-foreground/10" : "bg-accent-foreground/10",
    message.mediaUrl ? "rounded-md" : "rounded-full",
  );

  const name = isOwn
    ? session.data?.user.name
    : message.conversation?.lead?.name;

  const IconStatus = IconsStatus[message.status];

  return (
    <div className={container}>
      <div className={body}>
        <div className="flex items-center gap-1">
          <div className="text-sm">{name}</div>
        </div>

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
            <div className="whitespace-pre-wrap py-2 px-3">{message.body}</div>
          )}
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
