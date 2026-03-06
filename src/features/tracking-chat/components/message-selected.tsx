import { Button } from "@/components/ui/button";
import { Camera, FileIcon, Mic, PlayCircle, XIcon } from "lucide-react";
import { MarkedMessage } from "../types";
import Image from "next/image";
import { useConstructUrl } from "@/hooks/use-construct-url";

interface MessageSelectedProps {
  messageSelected: MarkedMessage;
  closeMessageSelected: () => void;
}

export function MessageSelected({
  messageSelected,
  closeMessageSelected,
}: MessageSelectedProps) {
  const senderName = messageSelected.fromMe
    ? "Você"
    : messageSelected.lead.name;

  const mimetype = messageSelected.mimetype;
  const isImage = mimetype?.startsWith("image");
  const isVideo = mimetype?.startsWith("video");
  const isAudio = mimetype?.startsWith("audio");
  const isFile = mimetype && !isImage && !isVideo && !isAudio;
  const isText = !mimetype;

  const mediaUrl = useConstructUrl(messageSelected.mediaUrl || "");

  const handleScrollToMessage = () => {
    const element = document.getElementById(`message-${messageSelected.id}`);
    if (element) {
      window.dispatchEvent(new CustomEvent("manual-scroll-started"));
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("bg-green-500/20");
      setTimeout(() => {
        element.classList.remove("bg-green-500/20");
      }, 2000);
    }
  };

  return (
    <div
      onClick={handleScrollToMessage}
      className="w-full bg-accent h-fit flex items-center justify-between px-4 rounded-md border-l-4 border-l-green-400 shadow-sm cursor-pointer hover:bg-accent/80 transition-colors"
    >
      <div className="flex-1 flex flex-row items-center gap-3 min-w-0 ">
        <div className="flex-1 flex flex-col min-w-0 py-4">
          <div className="text-sm font-semibold text-green-400">
            {senderName}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
            {isImage && (
              <>
                <Camera className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  Foto {messageSelected.body && `- ${messageSelected.body}`}
                </span>
              </>
            )}
            {isVideo && (
              <>
                <PlayCircle className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  Vídeo {messageSelected.body && `- ${messageSelected.body}`}
                </span>
              </>
            )}
            {isAudio && (
              <>
                <Mic className="w-4 h-4 shrink-0" />
                <span className="truncate">Áudio</span>
              </>
            )}
            {isFile && (
              <>
                <FileIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {messageSelected.fileName || "Documento"}
                </span>
              </>
            )}
            {isText && (
              <span className="truncate text-foreground/80">
                {messageSelected.body}
              </span>
            )}
          </div>
        </div>

        {(isImage || isVideo) && messageSelected.mediaUrl && (
          <div className="w-18 h-18 shrink-0 relative bg-muted rounded overflow-hidden">
            <Image alt="Preview" src={mediaUrl} fill className="object-cover" />
            {isVideo && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                <PlayCircle className="w-5 h-5 text-white/80 fill-black/20" />
              </div>
            )}
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          closeMessageSelected();
        }}
        className="ml-2 shrink-0"
      >
        <XIcon className="size-5" />
      </Button>
    </div>
  );
}
