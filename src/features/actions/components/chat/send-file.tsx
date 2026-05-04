"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SendIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useConstructUrl } from "@/hooks/use-construct-url";

import { useMutationActionChatFileMessage } from "../../hooks/use-action-chat";
import { MarkedActionChatMessage } from "./types";

interface Props {
  actionId: string;
  file: string;
  fileType: "image" | "file";
  fileName?: string;
  mimetype?: string;
  onClose: () => void;
  messageSelected?: MarkedActionChatMessage;
}

export function SendFile({
  actionId,
  file,
  fileType,
  fileName,
  mimetype,
  onClose,
  messageSelected,
}: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const constructedUrl = useConstructUrl(file);

  const mutation = useMutationActionChatFileMessage({
    actionId,
    messageSelected,
  });

  useEffect(() => {
    setPreview(file);
  }, [file]);

  async function handleCancel() {
    onClose();
    await fetch("/api/s3/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: file }),
    });
  }

  const handleSend = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    mutation.mutate({
      actionId,
      mediaUrl: file,
      mediaType: fileType,
      fileName: fileName,
      mimetype: mimetype ?? (fileType === "image" ? "image/jpeg" : "application/octet-stream"),
      body: caption.trim() || undefined,
      quotedMessageId: messageSelected?.id,
    });
    onClose();
  };

  return (
    <form
      onSubmit={handleSend}
      className="absolute inset-0 z-50 flex flex-col bg-background border rounded-md p-4 gap-6"
    >
      <div className="flex justify-between items-center">
        <Button type="button" variant="ghost" size="icon" onClick={handleCancel}>
          <XIcon className="size-5" />
        </Button>
        <p className="text-sm font-medium text-muted-foreground">
          {fileType === "image" ? "Enviar imagem" : "Enviar arquivo"}
        </p>
        <span className="size-9" />
      </div>

      <div className="flex-1 flex items-center justify-center min-h-0">
        {fileType === "image" && preview ? (
          <div className="relative w-full h-full">
            <Image
              src={constructedUrl}
              alt={fileName ?? "Imagem"}
              fill
              className="object-contain"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="size-24 bg-muted rounded-lg flex items-center justify-center">
              <span className="text-2xl font-bold uppercase">
                {fileName?.split(".").pop() ?? "file"}
              </span>
            </div>
            <p className="text-sm font-medium">{fileName ?? "Documento"}</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Input
          autoComplete="off"
          name="caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Adicionar legenda (opcional)..."
        />
        <Button type="submit" size="icon" className="rounded-full">
          <SendIcon className="size-4" />
        </Button>
      </div>
    </form>
  );
}
