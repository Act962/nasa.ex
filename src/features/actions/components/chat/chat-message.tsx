"use client";

import { useState } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CornerUpLeftIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  Trash2Icon,
  CopyIcon,
} from "lucide-react";
import { toast } from "sonner";

import { FileMessageBox } from "@/features/tracking-chat/components/file-message-box";
import { AudioMessageBox } from "@/features/tracking-chat/components/audio-message-box";
import { ImageViewerDialog } from "@/features/tracking-chat/components/image-viewer-dialog";

import { ActionChatMessage as ActionChatMessageType, MarkedActionChatMessage } from "./types";
import { ChatQuotedMessage } from "./chat-quoted-message";

interface Props {
  message: ActionChatMessageType;
  currentUserId: string;
  onSelectMessage: (m: MarkedActionChatMessage) => void;
  onDelete: (messageId: string) => void;
  onEdit: (messageId: string, currentBody: string) => void;
}

export function ChatMessage({
  message,
  currentUserId,
  onSelectMessage,
  onDelete,
  onEdit,
}: Props) {
  const isOwn = message.senderId === currentUserId;
  const [showImageViewer, setShowImageViewer] = useState(false);

  const isImage =
    message.mediaType === "image" || message.mimetype?.startsWith("image");
  const isAudio =
    message.mediaType === "audio" || message.mimetype?.startsWith("audio");
  const isFile =
    !isImage &&
    !isAudio &&
    (message.mediaType === "file" ||
      message.mimetype?.startsWith("application") ||
      message.mimetype?.startsWith("text"));

  const isMediaOnly = (isImage || isAudio || isFile) && !message.body;

  const constructedImage = useConstructUrl(
    isImage && message.mediaUrl ? message.mediaUrl : "",
  );

  const handleScrollToQuoted = () => {
    if (!message.quotedMessageId) return;
    const el = document.getElementById(`action-msg-${message.quotedMessageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary/50", "rounded-md");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary/50", "rounded-md");
      }, 1500);
    }
  };

  if (message.isDeleted) {
    return (
      <div
        id={`action-msg-${message.id}`}
        className={cn("flex gap-2 px-3 py-1", isOwn && "justify-end")}
      >
        <span className="text-xs italic text-muted-foreground bg-muted/50 rounded-md px-2 py-1">
          Mensagem apagada
        </span>
      </div>
    );
  }

  return (
    <div
      id={`action-msg-${message.id}`}
      className={cn(
        "group flex gap-2 px-3 py-1",
        isOwn ? "justify-end" : "justify-start",
      )}
    >
      {!isOwn && (
        <Avatar className="size-7 shrink-0 mt-0.5">
          <AvatarImage src={message.sender.image ?? undefined} />
          <AvatarFallback className="text-[10px]">
            {message.sender.name?.charAt(0).toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn("flex flex-col max-w-[70%]", isOwn && "items-end")}>
        {!isOwn && (
          <span className="text-[11px] font-medium text-muted-foreground px-1 mb-0.5">
            {message.sender.name ?? "Anônimo"}
          </span>
        )}

        <div className={cn("flex items-start gap-1", isOwn && "flex-row-reverse")}>
          <div
            className={cn(
              "rounded-lg px-2 py-1.5 text-sm relative",
              isOwn ? "bg-primary text-primary-foreground" : "bg-muted",
              isMediaOnly && "p-1 bg-transparent",
            )}
          >
            {message.quotedMessage && (
              <ChatQuotedMessage
                quotedMessage={message.quotedMessage}
                isOwn={isOwn}
                onClick={handleScrollToQuoted}
              />
            )}

            {isImage && message.mediaUrl && (
              <>
                <Image
                  src={constructedImage}
                  alt="Imagem"
                  width={300}
                  height={300}
                  className="rounded max-h-60 w-auto object-contain cursor-pointer hover:opacity-90"
                  onClick={() => setShowImageViewer(true)}
                />
                {showImageViewer && (
                  <ImageViewerDialog
                    open={showImageViewer}
                    onOpenChange={setShowImageViewer}
                    message={
                      {
                        id: message.id,
                        messageId: message.id,
                        body: message.body,
                        mediaUrl: message.mediaUrl,
                        mimetype: message.mimetype ?? "image/jpeg",
                        fileName: message.fileName,
                        fromMe: isOwn,
                        senderName: message.senderName,
                        quotedMessageId: message.quotedMessageId,
                        createdAt: message.createdAt
                          ? message.createdAt instanceof Date
                            ? message.createdAt
                            : new Date(message.createdAt)
                          : new Date(),
                        conversation: { lead: { id: "", name: "" } },
                      } as any
                    }
                    onReply={() =>
                      onSelectMessage({
                        id: message.id,
                        body: message.body,
                        mediaUrl: message.mediaUrl,
                        mediaType: message.mediaType,
                        mimetype: message.mimetype,
                        fileName: message.fileName,
                        senderId: message.senderId,
                        senderName: message.senderName,
                        createdAt: message.createdAt,
                      })
                    }
                  />
                )}
              </>
            )}

            {isFile && message.mediaUrl && (
              <FileMessageBox
                mediaUrl={message.mediaUrl}
                mimetype={message.mimetype ?? ""}
                fileName={message.fileName}
              />
            )}

            {isAudio && message.mediaUrl && (
              <AudioMessageBox
                mediaUrl={message.mediaUrl}
                mimetype={message.mimetype ?? "audio/mpeg"}
              />
            )}

            {message.body && (
              <div className="break-words whitespace-pre-wrap leading-snug px-1.5">
                {message.body}
              </div>
            )}

            <div
              className={cn(
                "flex items-center gap-1 text-[10px] mt-0.5 opacity-70",
                isOwn ? "text-primary-foreground/80" : "text-muted-foreground",
                isMediaOnly && "text-foreground bg-background/80 rounded px-1",
              )}
            >
              {message.isEdited && <span>(editada)</span>}
              <span>
                {format(
                  message.createdAt instanceof Date
                    ? message.createdAt
                    : new Date(message.createdAt),
                  "HH:mm",
                )}
              </span>
            </div>
          </div>

          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-start gap-0.5 mt-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground hover:text-foreground"
              onClick={() =>
                onSelectMessage({
                  id: message.id,
                  body: message.body,
                  mediaUrl: message.mediaUrl,
                  mediaType: message.mediaType,
                  mimetype: message.mimetype,
                  fileName: message.fileName,
                  senderId: message.senderId,
                  senderName: message.senderName,
                  createdAt: message.createdAt,
                })
              }
              title="Responder"
            >
              <CornerUpLeftIcon className="size-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-foreground"
                >
                  <EllipsisVerticalIcon className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isOwn ? "end" : "start"}>
                {message.body && (
                  <DropdownMenuItem
                    onClick={() => {
                      navigator.clipboard.writeText(message.body ?? "");
                      toast.success("Mensagem copiada");
                    }}
                  >
                    <CopyIcon className="size-3.5 mr-2" /> Copiar
                  </DropdownMenuItem>
                )}
                {isOwn && message.body && (
                  <DropdownMenuItem
                    onClick={() => onEdit(message.id, message.body ?? "")}
                  >
                    <PencilIcon className="size-3.5 mr-2" /> Editar
                  </DropdownMenuItem>
                )}
                {isOwn && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(message.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2Icon className="size-3.5 mr-2" /> Apagar
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
