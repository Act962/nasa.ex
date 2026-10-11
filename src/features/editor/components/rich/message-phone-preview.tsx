import { FileTextIcon, ImageIcon, MicIcon } from "lucide-react";
import { WhatsappIcon } from "@/components/whatsapp";
import { cn } from "@/lib/utils";

// Celular com a mensagem como o cliente vê, para os quadros de envio (spec 0090, RF-9).

export interface PhoneMessage {
  kind: "text" | "image" | "document" | "voice" | "buttons" | "template";
  text: string;
  /** Opções do menu de botões. */
  options?: string[];
  /** Nome do arquivo ou do modelo. */
  label?: string;
}

const MAX_BUTTONS = 3;
const MAX_VISIBLE_OPTIONS = 5;

export function MessagePhonePreview({ message, isUndelivered }: { message: PhoneMessage; isUndelivered?: boolean }) {
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
        WhatsApp
      </div>
      <div className="min-h-[92px] space-y-1 bg-muted/40 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:12px_12px] p-2">
        <div className={cn("rounded-lg bg-card px-2 py-1.5 text-[10.5px] leading-snug shadow-sm", isUndelivered && "opacity-60")}>
          {message.kind === "image" && (
            <span className="mb-1 flex h-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <ImageIcon className="size-4" />
            </span>
          )}
          {message.kind === "document" && (
            <span className="mb-1 flex items-center gap-1 rounded-md bg-muted px-1.5 py-1 text-muted-foreground">
              <FileTextIcon className="size-3 shrink-0" />
              <span className="truncate">{message.label || "arquivo"}</span>
            </span>
          )}
          {message.kind === "voice" && (
            <span className="mb-1 flex items-center gap-1 text-muted-foreground">
              <MicIcon className="size-3" />
              áudio
            </span>
          )}
          {message.kind === "template" && (
            <span className="mb-1 block truncate text-[9.5px] font-semibold uppercase tracking-wide text-info">
              Template · {message.label || "sem nome"}
            </span>
          )}
          <span className="line-clamp-6 whitespace-pre-line break-words">{message.text || "Mensagem sem texto"}</span>
        </div>
        {options.length > 0 && (
          <div className={cn(isList ? "overflow-hidden rounded-lg bg-card shadow-sm" : "grid gap-0.5")}>
            {options.slice(0, MAX_VISIBLE_OPTIONS).map((option, optionIndex) => (
              <span
                key={`${option}-${optionIndex}`}
                className={cn(
                  "block truncate text-[10.5px]",
                  isList ? "border-b px-2 py-1 last:border-b-0" : "rounded-lg bg-card px-2 py-1 text-center font-medium text-info shadow-sm",
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
