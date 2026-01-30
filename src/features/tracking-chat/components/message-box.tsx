import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Image from "next/image";

export interface Message {
  id: string;
  body: string | null;
  mediaUrl: string | null;
  createdAt: Date;
  fromMe: boolean;
  conversation: {
    lead: {
      id: string;
      name: string;
    };
  };
}

export function MessageBox({ message }: { message: Message }) {
  const isOwn = message.fromMe;

  const container = cn("flex gap-2 p-4", isOwn && "justify-end");

  const body = cn("flex flex-col gap-2", isOwn && "items-end");

  const messageText = cn(
    "text-sm w-fit overflow-hidden",
    isOwn ? "bg-foreground/10" : "bg-accent-foreground/10",
    message.mediaUrl ? "rounded-md" : "rounded-full py-2 px-3",
  );

  return (
    <div className={container}>
      <div className={body}>
        <div className="flex items-center gap-1">
          <div className="text-sm">{message.conversation.lead.name}</div>
        </div>
        <div className="text-xs">
          {format(new Date(message.createdAt), "p")}
        </div>
        <div className={messageText}>
          {message.mediaUrl ? (
            <Image
              alt="Image"
              height={288}
              width={288}
              src={message.mediaUrl}
              className="object-cover cursor-pointer hover:scale-110 transition transalate"
            />
          ) : (
            <div className="whitespace-pre-wrap">{message.body}</div>
          )}
        </div>
      </div>
    </div>
  );
}
