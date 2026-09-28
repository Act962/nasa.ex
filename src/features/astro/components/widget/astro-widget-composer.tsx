"use client";

import { useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { Mic, Paperclip, SendHorizonal, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { AstroAttachmentChip } from "@/features/astro/components/astro-attachment-chip";
import type { PendingAstroAttachment } from "@/features/astro/hooks/use-astro-attachments";
import { useAstroOrbStore } from "@/features/astro/voice/use-astro-orb-store";
import { useAstroWidgetStore } from "@/features/astro/voice/use-astro-widget-store";
import { useAstroVoiceActions } from "@/features/astro/voice/use-astro-voice-actions";
import { unlockAudio } from "@/features/astro/voice/tts";
import { useFileDrop } from "@/features/nasa-command/hooks/use-file-drop";
import { ACCEPT_ATTACHMENT_TYPES } from "@/features/payment/lib/attachments";

/**
 * Campo do painel em pílula: clipe, texto, microfone e enviar. Arquivo entra
 * pelo clipe, colando ou arrastando, e sobe antes do envio (spec 0015, RF-3).
 */

const MAX_DRAFT_LENGTH = 4000;
const MAX_TEXTAREA_HEIGHT_PX = 112;

interface AstroWidgetComposerProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  loading: boolean;
  attachments: PendingAstroAttachment[];
  isUploading: boolean;
  onAddFiles: (files: File[]) => void;
  onRemoveAttachment: (localId: string) => void;
}

export function AstroWidgetComposer({
  draft,
  onDraftChange,
  onSubmit,
  onStop,
  loading,
  attachments,
  isUploading,
  onAddFiles,
  onRemoveAttachment,
}: AstroWidgetComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isWidgetOpen = useAstroWidgetStore((state) => state.isOpen);
  const orbPhase = useAstroOrbStore((state) => state.phase);
  const { captureUtterance } = useAstroVoiceActions();
  const { handlePaste, handleDrop, handleDragOver } = useFileDrop(onAddFiles);

  const isListening = orbPhase === "listening";
  const isVoiceSupported =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
  const hasReadyAttachment = attachments.some((attachment) => Boolean(attachment.attachmentId));
  const canSend = !loading && !isUploading && (draft.trim().length > 0 || hasReadyAttachment);

  // Abriu o painel: o campo já recebe o foco.
  useEffect(() => {
    if (isWidgetOpen) textareaRef.current?.focus();
  }, [isWidgetOpen]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
  }, [draft]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (canSend) onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) onSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="shrink-0 border-t border-white/[0.07] px-3 pb-3 pt-2.5">
      <div onDrop={handleDrop} onDragOver={handleDragOver}>
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachments.map((attachment) => (
              <AstroAttachmentChip
                key={attachment.localId}
                fileName={attachment.fileName}
                mimeType={attachment.mimeType}
                sizeBytes={attachment.sizeBytes}
                uploading={attachment.uploading}
                onRemove={() => onRemoveAttachment(attachment.localId)}
                className={attachment.error ? "border-rose-500/50 text-rose-300" : undefined}
              />
            ))}
          </div>
        )}

        <div
          className={cn(
            "flex items-end gap-1 rounded-[26px] bg-white/[0.05] p-1.5 transition-shadow",
            isListening
              ? "shadow-[inset_0_0_0_1.5px_rgba(59,130,246,0.85)]"
              : "shadow-[inset_0_0_0_1.5px_rgba(139,92,246,0.45)] focus-within:shadow-[inset_0_0_0_1.5px_rgba(167,139,250,0.9)]",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPT_ATTACHMENT_TYPES}
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length > 0) onAddFiles(files);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            aria-label="Anexar boleto, nota fiscal ou comprovante"
            title="Anexar boleto, nota fiscal ou comprovante"
            className="grid size-9 shrink-0 place-items-center rounded-full text-white/50 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
          >
            <Paperclip className="size-4" />
          </button>

          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            rows={1}
            maxLength={MAX_DRAFT_LENGTH}
            placeholder={isListening ? "Te ouvindo…" : "Pergunte ao Astro…"}
            aria-label="Mensagem para o Astro"
            className="min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-white outline-none placeholder:text-white/30"
          />

          {isVoiceSupported && !loading && (
            <button
              type="button"
              onClick={() => {
                unlockAudio();
                captureUtterance({ withGreeting: false });
              }}
              aria-label={isListening ? "Ouvindo" : "Falar com o Astro"}
              title={isListening ? "Ouvindo…" : "Falar com o Astro"}
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full transition",
                isListening
                  ? "animate-pulse bg-blue-500/20 text-blue-300"
                  : "text-white/50 hover:bg-white/[0.06] hover:text-white",
              )}
            >
              <Mic className="size-4" />
            </button>
          )}

          {loading ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Parar resposta"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.1] text-white transition hover:bg-white/[0.16]"
            >
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Enviar"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-600 text-white transition hover:bg-violet-500 disabled:bg-white/[0.08] disabled:text-white/30"
            >
              <SendHorizonal className="size-4" />
            </button>
          )}
        </div>
      </div>

      <p className="mt-2 px-1 text-[10px] text-white/30">
        O Astro é uma IA e pode errar. Nada é gravado sem a sua confirmação.
      </p>
    </form>
  );
}
