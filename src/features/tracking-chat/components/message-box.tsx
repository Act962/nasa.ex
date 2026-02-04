import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Image from "next/image";
import { Message } from "../types";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { FileMessageBox } from "./file-message-box";
import { AudioMessageBox } from "./audio-message-box";

export function MessageBox({ message }: { message: Message }) {
  const isOwn = message.fromMe;

  const container = cn("flex gap-2 p-4", isOwn && "justify-end");

  const body = cn("flex flex-col gap-2", isOwn && "items-end");

  const messageText = cn(
    "text-sm w-fit overflow-hidden space-y-2",
    isOwn ? "bg-foreground/10" : "bg-accent-foreground/10",
    message.mediaUrl ? "rounded-md" : "rounded-full",
  );

  return (
    <div className={container}>
      <div className={body}>
        <div className="flex items-center gap-1">
          <div className="text-sm">{message.conversation?.lead?.name}</div>
        </div>
        <div className="text-xs">
          {format(new Date(message.createdAt), "p")}
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
      </div>
    </div>
  );
}
