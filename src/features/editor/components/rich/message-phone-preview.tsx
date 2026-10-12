import { ImageIcon, MicIcon } from "lucide-react";
import { WhatsappIcon } from "@/components/whatsapp";
import { MetaLogo } from "@/features/meta-guide/components/meta-logo";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";

// Celular com a mensagem como o cliente vê, para os quadros de envio (spec 0090, RF-9).

export interface PhoneMessage {
  kind: "text" | "image" | "document" | "voice" | "buttons" | "template";
  text: string;
  /** Opções do menu de botões. */
  options?: string[];
  /** Nome do arquivo ou do modelo. */
  label?: string;
  /** Imagem ou arquivo enviado: endereço completo ou chave do armazenamento. */
  mediaUrl?: string;
  /** Título do modelo, quando ele tem. */
  headerText?: string;
}

const DOCUMENT_BADGE_COLORS: Record<string, string> = {
  PDF: "#dc2626",
  DOC: "#2563eb",
  DOCX: "#2563eb",
  XLS: "#16a34a",
  XLSX: "#16a34a",
  CSV: "#16a34a",
  PPT: "#ea580c",
  PPTX: "#ea580c",
  TXT: "#52525b",
  MD: "#52525b",
  ZIP: "#a16207",
};
const DEFAULT_DOCUMENT_BADGE_COLOR = "#52525b";
const MAX_EXTENSION_CHARS = 4;

/** "contrato.PDF" ou ".../tabela.csv?x=1" → "PDF", "CSV". Sem extensão reconhecível, "ARQ". */
function documentExtension(fileName: string | undefined, mediaUrl: string | undefined): string {
  for (const source of [fileName, mediaUrl]) {
    const extension = (source ?? "").split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i)?.[1];
    if (extension && extension.length <= MAX_EXTENSION_CHARS) return extension.toUpperCase();
  }
  return "ARQ";
}

function DocumentBadge({ fileName, mediaUrl }: { fileName?: string; mediaUrl?: string }) {
  const extension = documentExtension(fileName, mediaUrl);
  return (
    <span className="mb-1 flex items-center gap-1.5 rounded-md bg-muted px-1.5 py-1">
      <span
        className="flex h-7 w-6 shrink-0 items-end justify-center rounded-[3px] pb-0.5 text-[7px] font-bold leading-none text-white"
        style={{ backgroundColor: DOCUMENT_BADGE_COLORS[extension] ?? DEFAULT_DOCUMENT_BADGE_COLOR }}
      >
        {extension}
      </span>
      <span className="truncate text-muted-foreground">{fileName || "arquivo"}</span>
    </span>
  );
}

function ImageAttachment({ mediaUrl }: { mediaUrl?: string }) {
  const imageUrl = useConstructUrl(mediaUrl ?? "");
  if (!imageUrl) {
    return (
      <span className="mb-1 flex h-16 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <ImageIcon className="size-4" />
      </span>
    );
  }
  // Prévia pequena de arquivo já enviado pela própria empresa; não passa pelo otimizador de imagens.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={imageUrl} alt="" loading="lazy" className="mb-1 h-20 w-full rounded-md bg-muted object-cover" />;
}

const MAX_BUTTONS = 3;
const MAX_VISIBLE_OPTIONS = 5;

const PHONE_CHROME_HEIGHT = 50;
const PHONE_BODY_MIN_HEIGHT = 92;
const PHONE_BODY_PADDING = 16;
const BUBBLE_PADDING = 12;
const TEXT_LINE_HEIGHT = 14.5;
const TEXT_CHARS_PER_LINE = 26;
const MAX_TEXT_LINES = 6;
const OPTION_ROW_HEIGHT = 24;
const ATTACHMENT_HEIGHT: Partial<Record<PhoneMessage["kind"], number>> = { image: 84, document: 40, voice: 20, template: 22 };

/** Altura aproximada do celular, para quem precisa reservar espaço antes de desenhar (mapa da operação). */
export function estimatePhoneHeight(message: PhoneMessage): number {
  const wrappedLines = (message.text || "Mensagem sem texto")
    .split("\n")
    .reduce((lineCount, paragraph) => lineCount + Math.max(1, Math.ceil(paragraph.length / TEXT_CHARS_PER_LINE)), 0);
  const titleHeight = message.kind === "template" && message.headerText ? TEXT_LINE_HEIGHT : 0;
  const bubbleHeight = BUBBLE_PADDING + (ATTACHMENT_HEIGHT[message.kind] ?? 0) + titleHeight + Math.min(MAX_TEXT_LINES, wrappedLines) * TEXT_LINE_HEIGHT;
  const optionCount = message.options?.length ?? 0;
  const visibleRows = optionCount > MAX_BUTTONS ? Math.min(optionCount, MAX_VISIBLE_OPTIONS) + (optionCount > MAX_VISIBLE_OPTIONS ? 1 : 0) : optionCount;
  const optionsHeight = visibleRows > 0 ? visibleRows * OPTION_ROW_HEIGHT + 6 : 0;
  return Math.ceil(PHONE_CHROME_HEIGHT + Math.max(PHONE_BODY_MIN_HEIGHT, PHONE_BODY_PADDING + bubbleHeight + optionsHeight));
}

export function MessagePhonePreview({
  message,
  isUndelivered,
  channelLabel,
}: {
  message: PhoneMessage;
  isUndelivered?: boolean;
  /** Número e nome da conexão por onde a mensagem sai. */
  channelLabel?: string;
}) {
  const options = message.options ?? [];
  const isList = options.length > MAX_BUTTONS;
  return (
    <div className="w-[184px] overflow-hidden rounded-[20px] border-2 border-border bg-background text-left">
      <div className="flex h-3 items-center justify-center bg-muted">
        <span className="h-[3px] w-10 rounded-full bg-border" />
      </div>
      <div className="flex items-center gap-1.5 bg-muted px-2 py-1 text-[10px] font-semibold">
        <span className="flex size-4 items-center justify-center rounded-full bg-brand-whatsapp text-white">
          <WhatsappIcon className="size-2.5" />
        </span>
        <span className="min-w-0">
          <span className="block leading-tight">WhatsApp</span>
          {channelLabel && <span className="block truncate text-[8.5px] font-normal leading-tight text-muted-foreground">{channelLabel}</span>}
        </span>
      </div>
      <div className="min-h-[92px] space-y-1 bg-muted/40 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:12px_12px] p-2">
        <div className={cn("rounded bg-card px-2 py-1.5 text-[10.5px] leading-snug shadow-sm", isUndelivered && "opacity-60")}>
          {message.kind === "image" && <ImageAttachment mediaUrl={message.mediaUrl} />}
          {message.kind === "document" && <DocumentBadge fileName={message.label} mediaUrl={message.mediaUrl} />}
          {message.kind === "voice" && (
            <span className="mb-1 flex items-center gap-1 text-muted-foreground">
              <MicIcon className="size-3" />
              áudio
            </span>
          )}
          {message.kind === "template" && (
            <>
              <span className="mb-1 flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wide text-brand-facebook">
                <MetaLogo className="size-3.5" />
                <span className="truncate">Template · {message.label || "sem nome"}</span>
              </span>
              {message.headerText && <span className="mb-0.5 block font-semibold">{message.headerText}</span>}
            </>
          )}
          <span className="line-clamp-6 whitespace-pre-line break-words">{message.text || (message.kind === "image" || message.kind === "document" ? "" : "Mensagem sem texto")}</span>
        </div>
        {options.length > 0 && (
          <div className={cn(isList ? "overflow-hidden rounded bg-card shadow-sm" : "grid gap-0.5")}>
            {options.slice(0, MAX_VISIBLE_OPTIONS).map((option, optionIndex) => (
              <span
                key={`${option}-${optionIndex}`}
                className={cn(
                  "block truncate text-[10.5px]",
                  isList ? "border-b px-2 py-1 last:border-b-0" : "rounded bg-card px-2 py-1 text-center font-medium text-info shadow-sm",
                )}
              >
                {option || "sem texto"}
              </span>
            ))}
            {options.length > MAX_VISIBLE_OPTIONS && (
              <span className="block px-2 py-1 text-[10px] text-muted-foreground">e mais {options.length - MAX_VISIBLE_OPTIONS}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
