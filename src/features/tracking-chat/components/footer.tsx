"use client";

import { ImageIcon, SendIcon } from "lucide-react";
import { MessageInput } from "./message-input";
import { Button } from "@/components/ui/button";

export function Footer() {
  return (
    <div className="py-4 px-4 bg-accent-foreground/10 border-t flex items-center gap-2 lg:gap-4 w-full">
      <ImageIcon className="" />
      <form className="flex items-center gap-2 lg:gap-4 w-full">
        <MessageInput placeholder="Digite sua mensagem..." />
        <Button type="submit" className="rounded-full ">
          <SendIcon size={18} />
        </Button>
      </form>
    </div>
  );
}
