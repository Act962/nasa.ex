"use client";

import { useEffect, useRef, useState } from "react";
import {
  BellIcon,
  FileIcon,
  ImageIcon,
  MicIcon,
  PlusIcon,
  SendIcon,
  StickerIcon,
} from "lucide-react";
import pt from "emoji-picker-react/dist/data/emojis-pt.json";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { EmojiData } from "emoji-picker-react/dist/types/exposedTypes";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import { Uploader } from "@/components/file-uploader/uploader";
import { SendAudio } from "@/features/tracking-chat/components/send-audio";

import {
  useMutationActionChatFileMessage,
  useMutationActionChatTextMessage,
} from "../../hooks/use-action-chat";
import { MarkedActionChatMessage } from "./types";
import { SendFile } from "./send-file";
import { ActionReminderPanel } from "./reminder-panel";

interface Props {
  actionId: string;
  actionTitle: string;
  messageSelected?: MarkedActionChatMessage;
  closeMessageSelected: () => void;
}

export function ChatFooter({
  actionId,
  actionTitle,
  messageSelected,
  closeMessageSelected,
}: Props) {
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [openSticker, setOpenSticker] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{
    key: string;
    type: "image" | "file";
    fileName?: string;
    mimetype?: string;
  } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const textMutation = useMutationActionChatTextMessage({
    actionId,
    messageSelected,
  });
  const fileMutation = useMutationActionChatFileMessage({
    actionId,
    messageSelected,
  });

  useEffect(() => {
    if (messageSelected) inputRef.current?.focus();
  }, [messageSelected]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (message.trim().length === 0) return;
    textMutation.mutate({
      actionId,
      body: message.trim(),
      quotedMessageId: messageSelected?.id,
    });
    setMessage("");
    closeMessageSelected();
  };

  const handleFilePicked = (
    key: string,
    type: "image" | "file",
    fileName?: string,
    mimetype?: string,
  ) => {
    setSelectedFile({ key, type, fileName, mimetype });
    setOpen(false);
    setIsLoading(false);
  };

  const handleSubmitAudio = async (blob: Blob) => {
    try {
      setIsLoading(true);
      const fileName = `audio-${Date.now()}.webm`;
      const presignedResp = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: fileName,
          contentType: blob.type || "audio/webm",
          size: blob.size,
          isImage: false,
        }),
      });

      if (!presignedResp.ok) {
        toast.error("Falha ao preparar upload de áudio");
        return;
      }

      const { presignedUrl, key } = await presignedResp.json();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 204) resolve();
          else reject(new Error("Falha no upload"));
        };
        xhr.onerror = () => reject(new Error("Falha no upload"));
        xhr.open("PUT", presignedUrl);
        xhr.setRequestHeader("Content-Type", blob.type || "audio/webm");
        xhr.send(blob);
      });

      fileMutation.mutate({
        actionId,
        mediaUrl: key,
        mediaType: "audio",
        fileName,
        mimetype: blob.type || "audio/webm",
        quotedMessageId: messageSelected?.id,
      });
      closeMessageSelected();
    } catch {
      toast.error("Erro ao enviar áudio");
    } finally {
      setIsLoading(false);
      setShowAudioRecorder(false);
    }
  };

  return (
    <div className="relative">
      <form
        className="py-2 flex flex-col items-center gap-2 w-full"
        onSubmit={handleSubmit}
      >
        {messageSelected && (
          <div className="w-full flex items-center justify-between bg-muted/50 rounded-md px-3 py-2 border-l-2 border-primary/40">
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[11px] font-semibold text-primary">
                {messageSelected.senderName ?? "Mensagem"}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {messageSelected.body ??
                  (messageSelected.mediaType === "image"
                    ? "📷 Imagem"
                    : messageSelected.mediaType === "audio"
                      ? "🎵 Áudio"
                      : messageSelected.mediaType === "file"
                        ? `📎 ${messageSelected.fileName ?? "Arquivo"}`
                        : "")}
              </span>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={closeMessageSelected}
            >
              <span className="text-lg leading-none">×</span>
            </Button>
          </div>
        )}

        <div className="w-full flex items-center gap-2 relative">
          {showReminder && (
            <ActionReminderPanel
              onClose={() => setShowReminder(false)}
              actionId={actionId}
              actionTitle={actionTitle}
            />
          )}

          {!showAudioRecorder ? (
            <InputGroup
              className={cn(
                "border border-border/60 has-[[data-slot=input-group-control]:focus-visible]:border-primary/50 has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-primary/20 shadow-sm bg-muted/60 hover:bg-muted/80 transition-colors rounded-2xl px-2",
                message.includes("\n") || message.length > 60
                  ? "items-end pb-1.5"
                  : "items-center",
              )}
            >
              <InputGroupAddon>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <PlusIcon className="cursor-pointer size-4" />
                  </PopoverTrigger>
                  <PopoverContent className="w-fit h-fit p-0">
                    <div className="relative w-full h-full cursor-pointer overflow-hidden">
                      <div className="relative flex items-center gap-2 hover:bg-foreground/10 py-3 px-4">
                        <ImageIcon className="size-4" />
                        <p className="text-sm">Imagem</p>
                        <div className="absolute top-0 left-0 w-full h-full opacity-0">
                          {isLoading ? (
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <Spinner className="size-3" />
                            </div>
                          ) : (
                            <Uploader
                              onUpload={(file, name) =>
                                handleFilePicked(file, "image", name, "image/jpeg")
                              }
                              onUploadStart={() => setIsLoading(true)}
                              fileTypeAccepted="image"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="relative w-full h-full cursor-pointer overflow-hidden">
                      <div className="relative flex items-center gap-2 hover:bg-foreground/10 py-3 px-4">
                        <FileIcon className="size-4" />
                        <p className="text-sm">Arquivo</p>
                        <div className="absolute top-0 left-0 w-full h-full opacity-0">
                          {isLoading ? (
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <Spinner className="size-3" />
                            </div>
                          ) : (
                            <Uploader
                              onUpload={(file, name) =>
                                handleFilePicked(
                                  file,
                                  "file",
                                  name,
                                  "application/octet-stream",
                                )
                              }
                              onUploadStart={() => setIsLoading(true)}
                              fileTypeAccepted="outros"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                    <div
                      className="relative flex items-center gap-2 hover:bg-foreground/10 py-3 px-4 cursor-pointer"
                      onClick={() => {
                        setShowReminder(true);
                        setOpen(false);
                      }}
                    >
                      <BellIcon className="size-4" />
                      <p className="text-sm">Lembrete</p>
                    </div>
                  </PopoverContent>
                </Popover>
              </InputGroupAddon>

              <InputGroupAddon>
                <Popover open={openSticker} onOpenChange={setOpenSticker}>
                  <PopoverTrigger asChild>
                    <StickerIcon className="cursor-pointer size-4" />
                  </PopoverTrigger>
                  <PopoverContent className="w-fit h-fit p-0">
                    <EmojiPicker
                      searchPlaceholder="Pesquisar emoji"
                      skinTonesDisabled
                      previewConfig={{ showPreview: false }}
                      emojiData={pt as EmojiData}
                      theme={Theme.DARK}
                      onEmojiClick={(emoji) =>
                        setMessage((prev) => prev + emoji.emoji)
                      }
                    />
                  </PopoverContent>
                </Popover>
              </InputGroupAddon>

              <InputGroupTextarea
                ref={inputRef as any}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite sua mensagem"
                className="resize-none min-h-0 py-2.5 text-sm max-h-[200px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (message.trim().length > 0) {
                      const form = e.currentTarget.closest("form");
                      if (form) form.requestSubmit();
                    }
                  }
                }}
              />

              <InputGroupAddon align="inline-end">
                {message.trim().length > 0 ? (
                  <Button type="submit" size="icon" className="rounded-full">
                    <SendIcon className="size-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => setShowAudioRecorder(true)}
                  >
                    <MicIcon className="size-4" />
                  </Button>
                )}
              </InputGroupAddon>
            </InputGroup>
          ) : (
            <SendAudio
              onCancel={() => setShowAudioRecorder(false)}
              onSend={(blob) => handleSubmitAudio(blob)}
            />
          )}
        </div>

      </form>

      {selectedFile && (
        <SendFile
          actionId={actionId}
          file={selectedFile.key}
          fileType={selectedFile.type}
          fileName={selectedFile.fileName}
          mimetype={selectedFile.mimetype}
          onClose={() => setSelectedFile(null)}
          messageSelected={messageSelected}
        />
      )}
    </div>
  );
}
