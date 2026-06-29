"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputGroupTextarea } from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import EmojiPicker, { Theme } from "emoji-picker-react";
import pt from "emoji-picker-react/dist/data/emojis-pt.json";
import { EmojiData } from "emoji-picker-react/dist/types/exposedTypes";
import { Check, Smile, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { Message } from "../types";

interface EditMessageProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialMessage: Message;
  timestamp?: Date;
  onSave: (text: string, messageId: string) => void;
}

export function EditMessage({
  isOpen,
  onOpenChange,
  initialMessage,
  timestamp = new Date(),
  onSave,
}: EditMessageProps) {
  const [message, setMessage] = useState<string>(initialMessage.body ?? "");
  const [openEmoji, setOpenEmoji] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMessage(initialMessage.body ?? "");
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, initialMessage]);

  const handleSave = () => {
    if (message.trim()) {
      onSave(message, initialMessage.messageId);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-xl">
        {/* Header */}
        <DialogHeader className="flex flex-row items-center gap-4 px-4 py-3 bg-foreground/10">
          <DialogTitle className="text-base font-normal">
            Editar mensagem
          </DialogTitle>
        </DialogHeader>

        {/* Content with WhatsApp Doodle Background */}
        <div className="relative flex flex-col items-center justify-center min-h-[200px] px-4 py-8 overflow-hidden">
          {/* WhatsApp Doodle Pattern Overlay */}
          <div
            className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage: `url('https://static.whatsapp.net/rsrc.php/v3/y6/r/wa669ae5dbc.png')`,
              backgroundRepeat: "repeat",
              backgroundSize: "400px",
            }}
          />

          {/* Message Bubble Preview */}
          <div className="relative z-10 max-w-[80%] bg-accent-foreground/10 text-[#e9edef] p-2 rounded-lg rounded-tr-none shadow-md mb-4 self-center min-w-[100px]">
            <p className="text-sm wrap-break-word whitespace-pre-wrap pr-12">
              {message || " "}
            </p>
            <div className="absolute bottom-1 right-2 flex items-center gap-1">
              <span className="text-[10px] text-[#ffffff99]">
                {format(timestamp, "HH:mm")}
              </span>
              <Check className="size-3 text-[#53bdeb]" />
            </div>

            {/* Bubble Tail */}
          </div>
        </div>

        {/* Footer with Input Area */}
        <div className="px-6 py-6 pb-8 bg-foreground/10 flex items-end gap-3 transition-all duration-200">
          <div className="flex-1 flex flex-col relative group">
            <InputGroupTextarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className=" border-0 border-b-2 bg-foreground/10 focus-visible:ring-0 rounded-none px-0 py-2 text-[#e9edef] text-sm min-h-0 max-h-[150px] resize-none overflow-y-auto w-full transition-colors duration-200"
              placeholder="Digite sua mensagem"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />

            {/* Emoji Button inside/next to textarea */}
            <div className="absolute right-0 bottom-2">
              <Popover open={openEmoji} onOpenChange={setOpenEmoji}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-[#8696a0] hover:bg-transparent hover:text-[#e9edef]"
                  >
                    <Smile className="size-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-fit p-0 border-none bg-transparent"
                  side="top"
                  align="end"
                  sideOffset={10}
                >
                  <EmojiPicker
                    theme={Theme.DARK}
                    emojiData={pt as EmojiData}
                    onEmojiClick={(emoji) =>
                      setMessage((prev) => prev + emoji.emoji)
                    }
                    previewConfig={{ showPreview: false }}
                    skinTonesDisabled
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Confirm Button */}
          <Button
            size="icon"
            className="size-8 rounded-full shrink-0 shadow-lg"
            onClick={handleSave}
          >
            <Check className="size-4 stroke-[3px]" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
