"use client";
import { Button } from "@/components/ui/button";
import { DownloadIcon, SendIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { MessageInput } from "./message-input";
import { useEffect, useState } from "react";
import { useMutationImageMessage } from "../hooks/use-messages";
import { fileToBase64 } from "@/utils/format-base-64";

interface sendImageProps {
  conversationId: string;
  lead: {
    id: string;
    name: string;
    phone: string | null;
  };
  file: File;
  onClose: () => void;
  leadPhone: string;
  token: string;
}

export default function SendImage({
  conversationId,
  lead,
  file,
  onClose,
  leadPhone,
  token,
}: sendImageProps) {
  const [preview, setPreview] = useState<string | null>(null);

  const mutation = useMutationImageMessage(conversationId, lead);

  const handleSendImage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const base64 = await fileToBase64(file);
    console.log(base64);
    mutation.mutate({
      body: formData.get("message") as string,
      mediaUrl: base64,
      conversationId,
      leadPhone,
      token,
    });
    onClose();
  };

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <form
      onSubmit={handleSendImage}
      className="w-full flex flex-col absolute bottom-0 top-0 z-50  h-full bg-accent p-4 gap-10"
    >
      <div className="w-full flex justify-between items-center">
        <Button type="button" variant="ghost" size="icon" onClick={onClose}>
          <XIcon className="size-6 cursor-pointer" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={onClose}>
          <DownloadIcon className="size-6 cursor-pointer" />
        </Button>
      </div>
      <div className="h-full flex items-center justify-center">
        <div className="relative w-full h-[80%] ">
          {preview && (
            <Image
              src={preview}
              alt={file.name || "image upload"}
              fill
              className="object-contain"
            />
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
