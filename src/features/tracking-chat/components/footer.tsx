"use client";

import {
  FileIcon,
  ImageIcon,
  MicIcon,
  PlusIcon,
  SendIcon,
  XIcon,
} from "lucide-react";
import { MessageInput } from "./message-input";
import { Button } from "@/components/ui/button";
import { useQueryInstances } from "@/features/tracking-settings/hooks/use-integration";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useMutationAudioMessage,
  useMutationTextMessage,
} from "../hooks/use-messages";
import { toast } from "sonner";
import { SendFile } from "./send-file";
import { useEffect, useRef, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { Uploader } from "@/components/file-uploader/uploader";
import { SendAudio } from "./send-audio";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Message, MarkedMessage } from "../types";

interface FooterProps {
  conversationId: string;
  lead: {
    id: string;
    name: string;
    phone: string | null;
  };
  trackingId: string;
}

export function Footer({
  conversationId,
  lead,
  trackingId,
  messageSelected,
  closeMessageSelected,
}: FooterProps & {
  messageSelected: MarkedMessage | undefined;
  closeMessageSelected: () => void;
}) {
  const instance = useQueryInstances(trackingId);
  const [selectedImage, setSelectedImage] = useState<string | undefined>(
    undefined,
  );
  const [selectedFileType, setSelectedFileType] = useState<"image" | "pdf">(
    "image",
  );
  const [sendImage, setSendImage] = useState(false);
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messageSelected) {
      inputRef.current?.focus();
    }
  }, [messageSelected]);

  const mutation = useMutationTextMessage({
    conversationId,
    lead,
  });
  const mutationAudio = useMutationAudioMessage({
    conversationId,
    lead,
    quotedMessageId: messageSelected?.messageId,
  });

  const isDisabled = !instance.instance;

  const handleSubmitAudio = (blob: Blob) => {
    const nameAudio = `audio-${Date.now()}-${blob.size}`;
    if (!instance.instance) return toast.error("Instância não encontrada");

    mutationAudio.mutate({
      blob: blob,
      leadPhone: lead.phone!,
      token: instance.instance.apiKey,
      nameAudio: nameAudio,
      mimetype: blob.type,
      conversationId,
      replyId: messageSelected?.messageId || undefined,
      id: messageSelected?.id,
    });
    closeMessageSelected();
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!instance.instance) return toast.error("Instância não encontrada");

    if (message.trim().length > 0) {
      mutation.mutate({
        body: message,
        leadPhone: lead.phone!,
        token: instance.instance.apiKey,
        conversationId: conversationId,
        replyId: messageSelected?.messageId,
        id: messageSelected?.id,
      });

      setMessage("");
      closeMessageSelected();
    }
  };

  const handleFileChange = (
    file: string,
    fileType: "image" | "pdf",
    name?: string,
  ) => {
    if (file) {
      setSelectedImage(file);
      setSelectedFileType(fileType);
      setSendImage(true);
      setOpen(false);
      setIsLoading(false);
      setFileName(name);
    }
  };

  const senderName = messageSelected?.fromMe ? "Você" : lead.name;

  return (
    <>
      <form
        className="py-4 px-4 bg-accent-foreground/10 border-t flex flex-col items-center gap-4  w-full"
        onSubmit={handleSubmit}
      >
        {messageSelected && (
          <div className="w-full bg-accent flex items-center justify-between p-4 rounded-md border-l-4 border-l-green-400">
            <div className="flex flex-col">
              <div className="text-sm font-semibold text-green-400">
                {senderName}
              </div>
              <div className="text-sm">{messageSelected.body}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={closeMessageSelected}
            >
              <XIcon className="size-6" />
            </Button>
          </div>
        )}
        <div className="w-full flex gap-2 lg:gap-4">
          {!showAudioRecorder && (
            <>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon">
                    <PlusIcon />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-fit h-fit p-0">
                  <div className="relative w-full h-full cursor-pointer overflow-hidden">
                    <div className="relative flex items-center gap-2 hover:bg-foreground/10 py-3 px-4 ">
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
                              handleFileChange(file, "pdf", name)
                            }
                            onUploadStart={() => setIsLoading(true)}
                            value={selectedImage}
                            fileTypeAccepted="outros"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="relative w-full h-full cursor-pointer overflow-hidden">
                    <div className="relative flex items-center gap-2 hover:bg-foreground/10 py-3 px-4 ">
                      <ImageIcon className="size-4" />
                      <p className="text-sm">Imagem</p>
                      <div className="absolute top-0 left-0 w-full h-full opacity-0">
                        {isLoading ? (
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <Spinner className="size-3" />
                          </div>
                        ) : (
                          <Uploader
                            onUpload={(file) => handleFileChange(file, "image")}
                            onUploadStart={() => setIsLoading(true)}
                            value={selectedImage}
                            fileTypeAccepted="image"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <div
                id="footer-form"
                className="flex items-center gap-2 lg:gap-4 w-full"
              >
                <MessageInput
                  ref={inputRef}
                  autoComplete="off"
                  name="message"
                  placeholder="Digite sua mensagem..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                {message.trim().length > 0 ? (
                  <Button
                    type="submit"
                    className="rounded-full"
                    disabled={isDisabled}
                  >
                    <SendIcon size={18} />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="rounded-full"
                    disabled={isDisabled}
                    onClick={() => setShowAudioRecorder(true)}
                  >
                    <MicIcon size={18} />
                  </Button>
                )}
              </div>
            </>
          )}
          {showAudioRecorder && (
            <SendAudio
              onCancel={() => setShowAudioRecorder(false)}
              onSend={(blob) => {
                handleSubmitAudio(blob);
                setShowAudioRecorder(false);
              }}
            />
          )}
        </div>
      </form>
      {sendImage && instance.instance && (
        <SendFile
          conversationId={conversationId}
          lead={lead}
          file={selectedImage!}
          onClose={() => {
            setSendImage(false);
            setSelectedImage(undefined);
            closeMessageSelected();
          }}
          leadPhone={lead.phone!}
          token={instance.instance?.apiKey}
          fileType={selectedFileType}
          fileName={fileName}
          messageSelected={messageSelected}
        />
      )}
    </>
  );
}
