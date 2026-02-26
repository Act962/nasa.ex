"use client";
import { Button } from "@/components/ui/button";
import { DownloadIcon, SendIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { MessageInput } from "./message-input";
import { useEffect, useState } from "react";
import {
  useMutationFileMessage,
  useMutationImageMessage,
} from "../hooks/use-messages";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { MarkedMessage } from "../types";
import { authClient } from "@/lib/auth-client";

interface sendFileProps {
  conversationId: string;
  lead: {
    id: string;
    name: string;
    phone: string | null;
  };
  file: string;
  onClose: () => void;
  leadPhone: string;
  token: string;
  fileType: "image" | "pdf";
  fileName?: string;
  messageSelected?: MarkedMessage;
}

export function SendFile({
  conversationId,
  lead,
  file,
  onClose,
  leadPhone,
  token,
  fileType,
  fileName,
  messageSelected,
}: sendFileProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const { data: session } = authClient.useSession();

  async function onCloseMessageSelected() {
    onClose();
    const response = await fetch("/api/s3/delete", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key: file,
      }),
    });
  }

  const mutation = useMutationImageMessage({
    conversationId,
    lead,
    quotedMessageId: messageSelected?.messageId,
    messageSelected,
  });
  const mutationFile = useMutationFileMessage({
    conversationId,
    lead,
    quotedMessageId: messageSelected?.messageId,
    messageSelected,
  });

  const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const messageBody = `*${session?.user.name}*\n${formData.get("message") as string}`;
    if (fileType === "image") {
      mutation.mutate({
        body: messageBody,
        mediaUrl: file,
        conversationId,
        leadPhone,
        token,
        id: messageSelected?.id,
        quotedMessageId: messageSelected?.messageId,
      });
    } else {
      mutationFile.mutate({
        body: messageBody,
        mediaUrl: file,
        fileName: fileName || "document",
        mimetype: `application/${fileType}`,
        conversationId,
        leadPhone,
        token,
        id: messageSelected?.id,
        quotedMessageId: messageSelected?.messageId,
      });
    }
    onClose();
  };

  useEffect(() => {
    setPreview(file);
  }, [file]);

  return (
    <form
      onSubmit={handleSend}
      className="w-full flex flex-col absolute bottom-0 top-0 z-50  h-full bg-accent p-4 gap-10"
    >
      <div className="w-full flex justify-between items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCloseMessageSelected}
        >
          <XIcon className="size-6 cursor-pointer" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={onClose}>
          <DownloadIcon className="size-6 cursor-pointer" />
        </Button>
      </div>
      <div className="h-full flex items-center justify-center">
        <div className="relative w-full h-[80%] flex items-center justify-center">
          {fileType === "image" ? (
            preview && (
              <Image
                src={useConstructUrl(preview)}
                fill
                alt={file || "image upload"}
                className="object-contain"
              />
            )
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="size-32 bg-foreground/10 rounded-lg flex items-center justify-center">
                <span className="text-4xl font-bold uppercase">
                  {fileName?.split(".").pop()}
                </span>
              </div>
              <p className="text-sm font-medium">{fileName}</p>
            </div>
          )}
        </div>
      </div>
      <div
        id="footer-form"
        className="flex items-center gap-2 lg:gap-4 w-[80%] mx-auto"
      >
        <MessageInput
          autoComplete="off"
          name="message"
          placeholder="Digite sua mensagem..."
        />
        <Button type="submit" className="rounded-full">
          <SendIcon size={18} />
        </Button>
      </div>
    </form>
  );
}
