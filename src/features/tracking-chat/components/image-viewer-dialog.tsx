"use client";

import { Button } from "@/components/ui/button";
import { DownloadIcon, ForwardIcon, Maximize2Icon, XIcon } from "lucide-react";
import Image from "next/image";
import { Message } from "../types";
import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";
import { handleDownload, handleOpen } from "@/utils/handle-files";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ImageViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: Message;
  onReply: () => void;
}

export function ImageViewerDialog({
  open,
  onOpenChange,
  message,
  onReply,
}: ImageViewerDialogProps) {
  const imageUrl = useConstructUrl(message.mediaUrl || "");
  const senderName = message.fromMe
    ? "Você"
    : message.conversation?.lead?.name || "Desconhecido";
  const dateStr = format(new Date(message.createdAt), "'Hoje às' p");

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 bg-accent flex items-center justify-center w-full h-screen overflow-hidden fade-in fade-out transition-all duration-300",
        open ? "flex" : "hidden",
      )}
    >
      <div className="w-full h-full p-0 border-none flex flex-col items-center justify-between">
        <div className="w-full flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-10 border border-white/20">
              <AvatarFallback>{senderName[0]}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-semibold text-sm text-white">
                {senderName}
              </span>
              <span className="text-xs text-zinc-400">{dateStr}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10"
                  onClick={() => handleOpen(imageUrl)}
                >
                  <Maximize2Icon className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Expandir</p>
              </TooltipContent>
            </Tooltip>

            <div className="w-px h-6 bg-white/20 mx-1 hidden sm:block" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10"
                  onClick={() => {
                    onReply();
                    onOpenChange(false);
                  }}
                >
                  <ForwardIcon className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Responder</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10"
                  onClick={() => handleDownload(imageUrl)}
                >
                  <DownloadIcon className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10"
                  onClick={() => onOpenChange(false)}
                >
                  <XIcon className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Fechar</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Main Image Area */}
        <div className="relative w-full flex-1 flex items-center justify-center p-4">
          <div className="relative w-full h-full max-w-6xl">
            <Image
              src={imageUrl}
              alt="Full view"
              fill
              className="object-contain size-full "
              priority
            />
          </div>
        </div>

        {/* Footer */}
        <div className="w-full flex justify-center p-6 z-50 bg-linear-to-t from-black/50 to-transparent">
          {message.body && (
            <p className="text-sm font-medium text-white text-center max-w-2xl">
              {message.body}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
