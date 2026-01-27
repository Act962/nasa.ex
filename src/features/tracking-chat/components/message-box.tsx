import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Image from "next/image";

interface Message {
  id: string;
  body: string | null;
  mediaUrl: string | null;
  createdAt: Date;
  fromMe: boolean;
  sender: {
    id: string;
    name: string;
  };
}
interface MessageBoxProps {
  data: Message;
  isLast?: boolean;
}

export function MessageBox({ data, isLast }: MessageBoxProps) {
  const isOwn = data.fromMe;
  const seenList = [];

  const container = cn("flex gap-2 p-4", isOwn && "justify-end");

  const body = cn("flex flex-col gap-2", isOwn && "items-end");

  const message = cn(
    "text-sm w-fit overflow-hidden",
    isOwn ? "bg-foreground/10" : "bg-accent-foreground/10",
    data.mediaUrl ? "rounded-md" : "rounded-full py-2 px-3",
  );

  return (
    <div className={container}>
      <div className={body}>
        <div className="flex items-center gap-1">
          <div className="text-sm">{data.sender.name}</div>
        </div>
        <div className="text-xs">{format(new Date(data.createdAt), "p")}</div>
        <div className={message}>
          {data.mediaUrl ? (
            <Image
              alt="Image"
              height={288}
              width={288}
              src={data.mediaUrl}
              className="object-cover cursor-pointer hover:scale-110 transition transalate"
            />
          ) : (
            <div>{data.body}</div>
          )}
        </div>
      </div>
    </div>
  );
}
