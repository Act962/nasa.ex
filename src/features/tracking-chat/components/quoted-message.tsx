import { authClient } from "@/lib/auth-client";
import { Message } from "../types";
import Image from "next/image";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { Camera, FileIcon, Mic, PlayCircle } from "lucide-react";
import { toast } from "sonner";

interface QuotedMessageProps {
  message: Message;
}

export function QuotedMessage({ message }: QuotedMessageProps) {
  const session = authClient.useSession();
  const quotedMessage = message.quotedMessage;

  if (!quotedMessage) return null;

  const sessionName = session.data?.user.name;
  const leadName = quotedMessage.conversation?.lead?.name;

  const quotedName = quotedMessage.fromMe ? sessionName : leadName || "Contato";

  console.log(message.body, message);

  const mimetype = quotedMessage.mimetype;
  const isImage = mimetype?.startsWith("image");
  const isVideo = mimetype?.startsWith("video");
  const isAudio = mimetype?.startsWith("audio");
  const isFile = mimetype && !isImage && !isVideo && !isAudio;
  const isText = !mimetype;

  const mediaUrl = useConstructUrl(quotedMessage.mediaUrl || "");

  const handleScrollToMessage = () => {
    const targetId = quotedMessage.id;
    const element = document.getElementById(`message-${targetId}`);

    if (element) {
      window.dispatchEvent(new CustomEvent("manual-scroll-started"));
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("bg-green-500/20");
      setTimeout(() => {
        element.classList.remove("bg-green-500/20");
      }, 2000);
    } else {
      console.warn(
        `Mensagem com ID message-${targetId} não encontrada no DOM.`,
      );
      toast.error("Mensagem não encontrada");
    }
  };

  return (
    <div
      onClick={handleScrollToMessage}
      className="flex bg-foreground/5 border-l-4 border-green-500 my-1 rounded-md text-xs max-w-[300px] overflow-hidden cursor-pointer hover:bg-foreground/10 transition-colors"
    >
      <div className="flex-1 flex flex-col p-2 min-w-0 justify-center gap-0.5">
        <span className="font-bold text-green-600 truncate">{quotedName}</span>
        <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
          {isImage && (
            <>
              <Camera className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                Foto {quotedMessage.body && `- ${quotedMessage.body}`}
              </span>
            </>
          )}
          {isVideo && (
            <>
              <PlayCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                Vídeo {quotedMessage.body && `- ${quotedMessage.body}`}
              </span>
            </>
          )}
          {isAudio && (
            <>
              <Mic className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Áudio</span>
            </>
          )}
          {isFile && (
            <>
              <FileIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {quotedMessage.fileName || "Documento"}
              </span>
            </>
          )}
          {isText && (
            <span className="truncate text-foreground/70">
              {quotedMessage.body}
            </span>
          )}
        </div>
      </div>
      {(isImage || isVideo) && quotedMessage.mediaUrl && (
        <div className="w-13 h-13 shrink-0 relative bg-muted flex items-center justify-center overflow-hidden border-l">
          <Image alt="Thumbnail" src={mediaUrl} fill className="object-cover" />
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
              <PlayCircle className="w-5 h-5 text-white/80 fill-black/20" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
