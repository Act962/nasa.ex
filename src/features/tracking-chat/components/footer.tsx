"use client";

import {
  ArchiveIcon,
  CalendarIcon,
  FileIcon,
  FileTextIcon,
  HammerIcon,
  ImageIcon,
  MicIcon,
  PlusIcon,
  ScrollTextIcon,
  SendIcon,
  SparklesIcon,
  StickerIcon,
} from "lucide-react";
import pt from "emoji-picker-react/dist/data/emojis-pt.json";
import EmojiPicker, { Theme } from "emoji-picker-react";
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
import { useMessageStore } from "../context/use-message";
import { useEffect, useRef, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { Uploader } from "@/components/file-uploader/uploader";
import { SendAudio } from "./send-audio";
import { MarkedMessage } from "../types";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { EmojiData } from "emoji-picker-react/dist/types/exposedTypes";
import { MessageSelected } from "./message-selected";
import { ComposeResponse } from "./compose-response";
import { ScriptsPanel } from "./scripts-panel";
import { ForgePanel } from "./forge-panel";
import { AgendaPanel } from "./agenda-panel";
import { FormsPanel } from "./forms-panel";
import { NBoxPanel } from "./nbox-panel";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

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
  const setInstanceData = useMessageStore((state) => state.setInstance);
  const instance = useQueryInstances(trackingId);
  const route = useRouter();
  const { data: session } = authClient.useSession();

  useEffect(() => {
    if (instance.instance) {
      setInstanceData({
        token: instance.instance.apiKey,
        baseUrl: instance.instance.baseUrl,
      });
    }
  }, [instance.instance, setInstanceData]);

  const [selectedImage, setSelectedImage] = useState<string | undefined>(
    undefined,
  );
  const [selectedFileType, setSelectedFileType] = useState<"image" | "pdf">(
    "image",
  );
  const [sendImage, setSendImage] = useState(false);
  const [open, setOpen] = useState(false);
  const [openSticker, setOpenSticker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState<string | undefined>(undefined);
  const [showScripts, setShowScripts] = useState(false);
  const [showForge, setShowForge] = useState(false);
  const [showAgenda, setShowAgenda] = useState(false);
  const [showForms, setShowForms] = useState(false);
  const [showNBox, setShowNBox] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messageSelected) {
      inputRef.current?.focus();
    }
  }, [messageSelected]);

  const mutation = useMutationTextMessage({
    conversationId,
    lead,
    messageSelected,
  });
  const mutationAudio = useMutationAudioMessage({
    conversationId,
    lead,
    quotedMessageId: messageSelected?.messageId,
    messageSelected,
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

    const messageBody = `*${session?.user.name}*\n${message}`;

    if (message.trim().length > 0) {
      mutation.mutate({
        body: messageBody,
        leadPhone: lead.phone!,
        token: instance.instance.apiKey,
        conversationId: conversationId,
        replyId: messageSelected?.messageId,
        replyIdInternal: messageSelected?.id,
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

  return (
    <>
      <form
        className="py-3 px-4 bg-background border-t flex flex-col items-center gap-2 w-full"
        onSubmit={handleSubmit}
      >
        {messageSelected && (
          <MessageSelected
            messageSelected={messageSelected}
            closeMessageSelected={closeMessageSelected}
          />
        )}

        <div className="w-full h-full flex items-center gap-2 lg:gap-4 relative">
          {showNBox && (
            <NBoxPanel
              onClose={() => setShowNBox(false)}
              onSendItem={(text) => {
                setMessage((prev) => (prev ? prev + "\n" + text : text));
                setShowNBox(false);
              }}
            />
          )}
          {showForms && (
            <FormsPanel
              onClose={() => setShowForms(false)}
              onSendLink={(text) => {
                setMessage((prev) => (prev ? prev + "\n" + text : text));
                setShowForms(false);
              }}
            />
          )}
          {showScripts && (
            <ScriptsPanel
              trackingId={trackingId}
              onClose={() => setShowScripts(false)}
              onSelectScript={(content) => {
                setMessage((prev) => prev + content);
                setShowScripts(false);
              }}
              leadName={lead.name}
              leadPhone={lead.phone ?? undefined}
            />
          )}
          {showForge && (
            <ForgePanel
              onClose={() => setShowForge(false)}
              onInsertLink={(text) => {
                setMessage((prev) => (prev ? prev + "\n" + text : text));
                setShowForge(false);
              }}
              leadId={lead.id}
              leadName={lead.name}
            />
          )}
          {showAgenda && (
            <AgendaPanel
              onClose={() => setShowAgenda(false)}
              lead={lead}
              onInsertLink={(text) => {
                setMessage((prev) => (prev ? prev + "\n" + text : text));
                setShowAgenda(false);
              }}
            />
          )}
          {!showAudioRecorder ? (
            <InputGroup
              className={cn(
                "border-0 has-[[data-slot=input-group-control]:focus-visible]:border-0 has-[[data-slot=input-group-control]:focus-visible]:ring-0 shadow-none bg-accent/50 rounded-2xl px-2",
                message.includes("\n") || message.length > 60
                  ? "items-end pb-1.5"
                  : "items-center",
              )}
            >
              {!isDisabled ? (
                <>
                  <InputGroupAddon>
                    <Popover open={open} onOpenChange={setOpen}>
                      <PopoverTrigger asChild>
                        <PlusIcon className="cursor-pointer size-4" />
                      </PopoverTrigger>
                      <PopoverContent className="w-fit h-fit p-0">
                        <div
                          className="relative flex items-center gap-2 hover:bg-foreground/10 py-3 px-4 cursor-pointer"
                          onClick={() => {
                            setShowNBox((v) => !v);
                            setShowForms(false);
                            setShowAgenda(false);
                            setShowScripts(false);
                            setShowForge(false);
                            setOpen(false);
                          }}
                        >
                          <ArchiveIcon className="size-4" />
                          <p className="text-sm">N-Box</p>
                        </div>
                        <div
                          className="relative flex items-center gap-2 hover:bg-foreground/10 py-3 px-4 cursor-pointer"
                          onClick={() => {
                            setShowForms((v) => !v);
                            setShowNBox(false);
                            setShowAgenda(false);
                            setShowScripts(false);
                            setShowForge(false);
                            setOpen(false);
                          }}
                        >
                          <FileTextIcon className="size-4" />
                          <p className="text-sm">Formulários</p>
                        </div>
                        <div
                          className="relative flex items-center gap-2 hover:bg-foreground/10 py-3 px-4 cursor-pointer"
                          onClick={() => {
                            setShowAgenda((v) => !v);
                            setShowScripts(false);
                            setShowForge(false);
                            setShowForms(false);
                            setShowNBox(false);
                            setOpen(false);
                          }}
                        >
                          <CalendarIcon className="size-4" />
                          <p className="text-sm">Agenda</p>
                        </div>
                        <div
                          className="relative flex items-center gap-2 hover:bg-foreground/10 py-3 px-4 cursor-pointer"
                          onClick={() => {
                            setShowScripts((v) => !v);
                            setShowForge(false);
                            setShowAgenda(false);
                            setShowForms(false);
                            setShowNBox(false);
                            setOpen(false);
                          }}
                        >
                          <ScrollTextIcon className="size-4" />
                          <p className="text-sm">Scripts</p>
                        </div>
                        <div
                          className="relative flex items-center gap-2 hover:bg-foreground/10 py-3 px-4 cursor-pointer"
                          onClick={() => {
                            setShowForge((v) => !v);
                            setShowScripts(false);
                            setShowAgenda(false);
                            setShowForms(false);
                            setShowNBox(false);
                            setOpen(false);
                          }}
                        >
                          <HammerIcon className="size-4" />
                          <p className="text-sm">Forge</p>
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
                                  onUpload={(file) =>
                                    handleFileChange(file, "image")
                                  }
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
                  </InputGroupAddon>

                  <InputGroupAddon>
                    <Popover open={openSticker} onOpenChange={setOpenSticker}>
                      <PopoverTrigger asChild>
                        <StickerIcon className="cursor-pointer size-4" />
                      </PopoverTrigger>
                      <PopoverContent className="w-fit h-fit p-0">
                        <EmojiPicker
                          searchPlaceholder="Pesquisar emoji"
                          skinTonesDisabled={true}
                          previewConfig={{ showPreview: false }}
                          emojiData={pt as EmojiData}
                          theme={Theme.DARK}
                          onEmojiClick={(emoji) =>
                            setMessage(message + emoji.emoji)
                          }
                        />
                      </PopoverContent>
                    </Popover>
                  </InputGroupAddon>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    onClick={() =>
                      route.push(`/tracking/${trackingId}/settings`)
                    }
                  >
                    Conectar instância
                  </Button>
                </>
              )}

              <InputGroupTextarea
                ref={inputRef as any}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={isDisabled ? "" : "Digite sua mensagem"}
                disabled={isDisabled}
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
                <ComposeResponse
                  conversationId={conversationId}
                  onResponse={(text) => setMessage(text)}
                />
              </InputGroupAddon>

              <InputGroupAddon align="inline-end">
                {message.trim().length > 0 ? (
                  <Button
                    type="submit"
                    size="icon"
                    className="rounded-full "
                    disabled={isDisabled}
                  >
                    <SendIcon className="size-4 " />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    disabled={isDisabled}
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
