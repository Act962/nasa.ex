"use client";

import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Image from "next/image";
import { MarkedMessage, MessageStatus, Message } from "../types";
import { Button } from "@/components/ui/button";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { FileMessageBox } from "./file-message-box";
import { AudioMessageBox } from "./audio-message-box";
import {
  CheckCheckIcon,
  CheckIcon,
  EllipsisVerticalIcon,
  LucideIcon,
  RedoIcon,
} from "lucide-react";
import { QuotedMessage } from "./quoted-message";
import {
  SelectedMessageOptions,
  SelectedMessageDropdown,
} from "./selected-message-options";
import { useMutationDeleteMessage } from "../hooks/use-messages";

import { useMessageStore } from "../context/use-message";
import { toast } from "sonner";
import { useState } from "react";
import { ImageViewerDialog } from "./image-viewer-dialog";
import { BodyMessage } from "./body-message";

export function MessageBox({
  message,
  onSelectMessage,
  conversationId,
}: {
  message: Message;
  messageSelected: MarkedMessage | undefined;
  onSelectMessage: (message: MarkedMessage) => void;
  conversationId: string;
}) {
  const isOwn = message.fromMe;
  const token = useMessageStore((state) => state.token);
  const deleteMessage = useMutationDeleteMessage({
    conversationId,
  });

  const [open, setOpen] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);

  const IconStatus = IconsStatus[message.status as MessageStatus];

  const isFile =
    message.mimetype?.startsWith("application/") ||
    message.mimetype?.startsWith("text/") ||
    message.mimetype?.startsWith("image/") ||
    message.mimetype?.startsWith("video/");

  const onDeleteMessage = () => {
    if (!token) return;
    deleteMessage.mutate({
      messageId: message.id,
      token: token,
      id: message.messageId,
    });
  };

  async function copyMessage() {
    await navigator.clipboard.writeText(message.body || "");
    toast.success("Mensagem copiada");
  }

  return (
    <>
      <SelectedMessageOptions
        message={message}
        onSelectMessage={onSelectMessage}
        onDeleteMessage={onDeleteMessage}
        onCopyMessage={copyMessage}
        onChange={setOpen}
        disabled={showImageViewer}
      >
        <div
          id={`message-${message.id}`}
          className={cn(
            "group flex gap-2 p-4 transition-colors duration-500",
            isOwn && "justify-end",
          )}
        >
          <div
            className={cn("flex relative flex-col gap-2", isOwn && "items-end")}
          >
            <div
              className={cn(
                "flex items-center gap-3",
                isOwn && "flex-row-reverse",
              )}
            >
              <div
                className={cn(
                  "text-sm w-fit overflow-hidden space-y-2 rounded-md px-1.5",
                  isOwn ? "bg-foreground/10" : "bg-accent-foreground/10",
                  isFile ? "bg-transparent px-0" : "",
                )}
              >
                {message.quotedMessage && <QuotedMessage message={message} />}
                <div className="relative w-fit py-1">
                  {message.mediaUrl &&
                    message.mimetype?.startsWith("image") && (
                      <>
                        <Image
                          alt="Image"
                          src={useConstructUrl(message.mediaUrl)}
                          className="object-contain cursor-pointer max-h-50 hover:opacity-90 transition-opacity"
                          width={288}
                          height={288}
                          onClick={() => setShowImageViewer(true)}
                        />
                        <ImageViewerDialog
                          open={showImageViewer}
                          onOpenChange={setShowImageViewer}
                          message={message}
                          onReply={() =>
                            onSelectMessage({
                              body: message.body,
                              id: message.id,
                              messageId: message.messageId,
                              fromMe: message.fromMe,
                              senderName: message.senderName,
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
                        />
                      </>
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
                  {message.mediaUrl &&
                    message.mimetype?.startsWith("audio") && (
                      <AudioMessageBox
                        mediaUrl={message.mediaUrl}
                        mimetype={message.mimetype}
                      />
                    )}
                  {message.body && (
                    <div className="whitespace-pre-wrap px-1.5 pt-1 ">
                      <BodyMessage message={message} />
                    </div>
                  )}
                </div>
              </div>
              <div
                className={cn("flex flex-row", !isOwn && "flex-row-reverse")}
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-100"
                  onClick={() =>
                    onSelectMessage({
                      body: message.body,
                      id: message.id,
                      messageId: message.messageId,
                      fromMe: message.fromMe,
                      senderName: message.senderName,
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
                <SelectedMessageDropdown
                  message={message}
                  onSelectMessage={onSelectMessage}
                  onDeleteMessage={onDeleteMessage}
                  onCopyMessage={copyMessage}
                  onChange={setOpen}
                >
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={`opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${open ? "opacity-100" : ""}`}
                  >
                    <EllipsisVerticalIcon className="size-3" />
                  </Button>
                </SelectedMessageDropdown>
              </div>
            </div>

            <div className="text-xs flex flex-row items-center gap-1">
              {format(new Date(message.createdAt), "p")}
              <IconStatus className="size-3" />
            </div>
          </div>
        </div>
      </SelectedMessageOptions>
    </>
  );
}

const IconsStatus: Record<MessageStatus, LucideIcon> = {
  [MessageStatus.SENT]: CheckIcon,
  [MessageStatus.SEEN]: CheckCheckIcon,
};
