import {
  CornerUpLeft,
  Copy,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  List,
  MapPin,
  Phone,
  Video,
} from "lucide-react";

/**
 * A partir de 4 botões o WhatsApp exibe só os 2 primeiros na mensagem e joga
 * todos numa lista atrás de "Ver todas as opções" (regra da Meta).
 */
const INLINE_BUTTON_LIMIT = 3;
const INLINE_BUTTONS_WHEN_LISTED = 2;

export type PreviewHeader =
  | { kind: "none" }
  | { kind: "text"; text: string }
  | { kind: "media"; format: "IMAGE" | "VIDEO" | "DOCUMENT"; fileName?: string | null }
  | { kind: "location" };

export interface PreviewButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE";
  label: string;
}

interface WhatsAppPreviewProps {
  header: PreviewHeader;
  body: string;
  footer?: string;
  buttons: PreviewButton[];
}

const MEDIA_ICON = {
  IMAGE: ImageIcon,
  VIDEO: Video,
  DOCUMENT: FileText,
} as const;

const BUTTON_ICON = {
  QUICK_REPLY: CornerUpLeft,
  URL: ExternalLink,
  PHONE_NUMBER: Phone,
  COPY_CODE: Copy,
} as const;

/**
 * Prévia fiel do template como aparece no WhatsApp — bolha de mensagem sobre o
 * fundo do chat, com header (mídia/texto), corpo, rodapé e botões tocáveis.
 * As variáveis já vêm substituídas pelos exemplos (renderização no builder).
 */
export function WhatsAppPreview({
  header,
  body,
  footer,
  buttons,
}: WhatsAppPreviewProps) {
  const time = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-xl bg-[#e5ddd5] p-4 dark:bg-[#0b141a]">
      <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white p-1.5 shadow-sm dark:bg-[#202c33]">
        {header.kind === "media" && <MediaHeader format={header.format} fileName={header.fileName} />}
        {header.kind === "location" && <LocationHeader />}

        <div className="px-1.5 pb-1 pt-1.5">
          {header.kind === "text" && header.text && (
            <p className="mb-1 whitespace-pre-wrap break-words text-[15px] font-semibold leading-snug text-foreground">
              {header.text}
            </p>
          )}

          {body ? (
            <p className="whitespace-pre-wrap break-words text-[14px] leading-snug text-foreground">
              {body}
            </p>
          ) : (
            <p className="text-[14px] italic leading-snug text-muted-foreground">
              O corpo da mensagem aparece aqui…
            </p>
          )}

          {footer && (
            <p className="mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-snug text-muted-foreground">
              {footer}
            </p>
          )}

          <div className="mt-0.5 text-right text-[11px] text-muted-foreground">
            {time}
          </div>
        </div>

        {buttons.length > 0 && (
          <div className="mt-0.5 border-t border-black/5 dark:border-white/10">
            {(buttons.length > INLINE_BUTTON_LIMIT
              ? buttons.slice(0, INLINE_BUTTONS_WHEN_LISTED)
              : buttons
            ).map((button, index) => {
              const Icon = BUTTON_ICON[button.type];
              return (
                <div
                  key={`${button.type}-${index}`}
                  className="flex items-center justify-center gap-2 border-t border-black/5 py-2 text-[14px] font-medium text-[#00a5f4] first:border-t-0 dark:border-white/10"
                >
                  <Icon className="size-4" />
                  {button.label || "Botão"}
                </div>
              );
            })}
            {buttons.length > INLINE_BUTTON_LIMIT && (
              <div className="flex items-center justify-center gap-2 border-t border-black/5 py-2 text-[14px] font-medium text-[#00a5f4] dark:border-white/10">
                <List className="size-4" />
                Ver todas as opções
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MediaHeader({
  format,
  fileName,
}: {
  format: "IMAGE" | "VIDEO" | "DOCUMENT";
  fileName?: string | null;
}) {
  const Icon = MEDIA_ICON[format];
  if (format === "DOCUMENT") {
    return (
      <div className="m-1 flex items-center gap-2 rounded-md bg-black/5 px-3 py-2.5 dark:bg-white/5">
        <Icon className="size-5 text-muted-foreground" />
        <span className="truncate text-[13px] text-foreground">
          {fileName || "documento.pdf"}
        </span>
      </div>
    );
  }
  return (
    <div className="m-1 flex aspect-video items-center justify-center rounded-md bg-black/10 dark:bg-white/5">
      <Icon className="size-8 text-muted-foreground" />
    </div>
  );
}

function LocationHeader() {
  return (
    <div className="m-1 flex aspect-[2/1] items-center justify-center rounded-md bg-black/10 dark:bg-white/5">
      <MapPin className="size-7 text-muted-foreground" />
    </div>
  );
}
