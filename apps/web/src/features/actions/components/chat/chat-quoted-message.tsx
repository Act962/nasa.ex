"use client";

import { CornerDownRightIcon, FileIcon, ImageIcon, MicIcon } from "lucide-react";
import { useConstructUrl } from "@/hooks/use-construct-url";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ActionChatQuotedMessage } from "./types";

interface Props {
  quotedMessage: ActionChatQuotedMessage;
  isOwn: boolean;
  onClick?: () => void;
}

export function ChatQuotedMessage({ quotedMessage, isOwn, onClick }: Props) {
  const isImage = quotedMessage.mediaType === "image" || quotedMessage.mimetype?.startsWith("image");
  const isAudio = quotedMessage.mediaType === "audio" || quotedMessage.mimetype?.startsWith("audio");
  const isFile =
    !isImage &&
    !isAudio &&
    (quotedMessage.mediaType === "file" ||
      quotedMessage.mimetype?.startsWith("application") ||
      quotedMessage.mimetype?.startsWith("text"));

  const constructedUrl = useConstructUrl(quotedMessage.mediaUrl ?? "");

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left flex gap-2 px-2 py-1.5 rounded border-l-2 mb-1",
        isOwn
          ? "bg-foreground/10 border-foreground/40"
          : "bg-muted border-primary/40",
      )}
    >
      <CornerDownRightIcon className="size-3 mt-0.5 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="text-[10px] font-semibold text-muted-foreground truncate">
          {quotedMessage.senderName ?? "Mensagem"}
        </p>
        {quotedMessage.isDeleted ? (
          <p className="text-xs italic text-muted-foreground">Mensagem apagada</p>
        ) : (
          <div className="flex items-center gap-1.5">
            {isImage && quotedMessage.mediaUrl && (
              <div className="size-8 rounded overflow-hidden shrink-0 relative bg-muted">
                <Image
                  src={constructedUrl}
                  alt=""
                  fill
                  className="object-cover"
                />
              </div>
            )}
            {isFile && <FileIcon className="size-3 shrink-0 text-muted-foreground" />}
            {isAudio && <MicIcon className="size-3 shrink-0 text-muted-foreground" />}
            {!isImage && !isFile && !isAudio && quotedMessage.body == null && (
              <ImageIcon className="size-3 shrink-0 text-muted-foreground" />
            )}
            <p className="text-xs line-clamp-2 break-words">
              {quotedMessage.body ?? (isImage ? "Imagem" : isAudio ? "Áudio" : isFile ? quotedMessage.fileName ?? "Arquivo" : "")}
            </p>
          </div>
        )}
      </div>
    </button>
  );
}
