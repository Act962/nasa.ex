"use client";

import { ImageIcon, SendIcon, UploadIcon } from "lucide-react";
import { MessageInput } from "./message-input";
import { Button } from "@/components/ui/button";
import { useQueryInstances } from "@/features/tracking-settings/hooks/use-integration";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useMutationTextMessage } from "../hooks/use-messages";
import { toast } from "sonner";
import SendImage from "./send-image";
import { useState } from "react";
import { Item } from "@/components/ui/item";

interface FooterProps {
  conversationId: string;
  lead: {
    id: string;
    name: string;
    phone: string | null;
  };
  trackingId: string;
}

export function Footer({ conversationId, lead, trackingId }: FooterProps) {
  const instance = useQueryInstances(trackingId);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [sendImage, setSendImage] = useState(false);
  const [open, setOpen] = useState(false);

  const mutation = useMutationTextMessage(conversationId, lead);

  const isDisabled = !instance.instance;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    console.log(e.currentTarget.elements);
    e.preventDefault();
    if (!instance.instance) return toast.error("Instância não encontrada");

    const messageValue = (
      e.currentTarget.elements.namedItem("message") as HTMLInputElement
    ).value;

    if (messageValue.trim().length > 0) {
      mutation.mutate({
        body: messageValue,
        leadPhone: lead.phone!,
        token: instance.instance.apiKey,
        conversationId: conversationId,
      });

      e.currentTarget.reset();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log("Arquivo selecionado:", file);
      setSelectedImage(file);
      setSendImage(true);
      setOpen(false);
    }
  };

  return (
    <>
      <form
        className="py-4 px-4 bg-accent-foreground/10 border-t flex items-center gap-2 lg:gap-4 w-full"
        onSubmit={handleSubmit}
      >
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <ImageIcon className="cursor-pointer" />
          </PopoverTrigger>
          <PopoverContent className="w-30 h-fit">
            <div className="relative w-full h-full cursor-pointer">
              <div className="relative  flex items-center gap-2">
                <UploadIcon className="size-4" />
                <p className="text-sm">Imagem</p>
                <input
                  placeholder=""
                  type="file"
                  accept="image/*"
                  className="w-full cursor-pointer opacity-0 absolute"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <div
          id="footer-form"
          className="flex items-center gap-2 lg:gap-4 w-full"
        >
          <MessageInput
            autoComplete="off"
            name="message"
            placeholder="Digite sua mensagem..."
          />
          <Button type="submit" className="rounded-full" disabled={isDisabled}>
            <SendIcon size={18} />
          </Button>
        </div>
      </form>
      {sendImage && instance.instance && (
        <SendImage
          conversationId={conversationId}
          lead={lead}
          file={selectedImage!}
          onClose={() => {
            setSendImage(false);
            setSelectedImage(null);
          }}
          leadPhone={lead.phone!}
          token={instance.instance.apiKey}
        />
      )}
    </>
  );
}
