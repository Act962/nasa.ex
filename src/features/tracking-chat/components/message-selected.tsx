import { Button } from "@/components/ui/button";
import { Camera, FileIcon, Mic, PlayCircle, XIcon } from "lucide-react";
import { MarkedMessage } from "../types";
import Image from "next/image";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { INSTAGRAM_MEDIA_TYPE_LABEL, readInstagramMetadata, type InstagramMediaCard } from "../lib/instagram-message-metadata";

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

  const instagram = readInstagramMetadata(messageSelected.metadata);
  if (instagram?.kind === "COMMENT") {
    return <InstagramCommentSelected messageSelected={messageSelected} media={instagram.media ?? null} closeMessageSelected={closeMessageSelected} />;
  }

  const handleScrollToMessage = () => {
    const element = document.getElementById(`message-${messageSelected.id}`);
    if (element) {
      window.dispatchEvent(new CustomEvent("manual-scroll-started"));
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("bg-success/20");
      setTimeout(() => {
        element.classList.remove("bg-success/20");
      }, 2000);
    }
  };

  return (
    <div
      onClick={handleScrollToMessage}
      className="w-full bg-accent h-fit flex items-center justify-between px-4 rounded-md border-l-4 border-l-success shadow-sm cursor-pointer hover:bg-accent/80 transition-colors"
    >
      <div className="flex-1 flex flex-row items-center gap-3 min-w-0 ">
        <div className="flex-1 flex flex-col min-w-0 py-4">
          <div className="text-sm font-semibold text-success">
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

/** Comentário do Instagram selecionado (spec 0062, RF-7): a resposta sai publicada nele. */
function InstagramCommentSelected({
  messageSelected,
  media,
  closeMessageSelected,
}: {
  messageSelected: MarkedMessage;
  media: InstagramMediaCard | null;
  closeMessageSelected: () => void;
}) {
  return (
    <div className="flex w-full items-center gap-2.5 rounded-md border-l-4 border-l-[#e1306c] bg-accent px-3 py-2 shadow-sm">
      {media?.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.thumbnailUrl} alt="" className="size-9 shrink-0 rounded-md object-cover" />
      )}
      <p className="min-w-0 flex-1 text-sm">
        Respondendo ao comentário <span className="font-semibold">&ldquo;{messageSelected.body}&rdquo;</span>
        <span className="text-muted-foreground">
          {media ? ` · no ${INSTAGRAM_MEDIA_TYPE_LABEL[media.mediaType]}${media.title ? ` ${media.title}` : ""}` : ""} · em público
        </span>
      </p>
      <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={closeMessageSelected} aria-label="Responder no Direct">
        <XIcon className="size-4" />
      </Button>
    </div>
  );
}
