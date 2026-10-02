import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { ArrowUp, AudioLines, Mic, MicOff, Plus } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { cn } from "@/lib/utils";
import { useVoiceInput } from "../hooks/use-voice-input";
import { unlockAudio } from "@/features/astro/voice/tts";
import { ModelSelector } from "./model-selector";
import { VariableDropdown } from "./variable-dropdown";
import { AppDropdown } from "./app-dropdown";
import { PlusMenu } from "./plus-menu";
import { DropdownType, ModelType } from "../types";
import { buildHighlightedHTML } from "../utils";
import type { PendingAstroAttachment } from "@/features/astro/hooks/use-astro-attachments";
import { CommandAttachmentList } from "./command-attachments";
import { VoiceCallPanel } from "@/features/astro/voice/realtime/voice-call-panel";
import { AstroUsageMeter } from "./astro-usage-meter";
import type { VoiceCallStatus } from "@/features/astro/voice/realtime/use-realtime-voice";
import { useFileDrop } from "../hooks/use-file-drop";

export interface CommandInputProps {
  command: string;
  setCommand: (v: string) => void;
  loading: boolean;
  onSubmit: () => void;
  onVoiceTranscript: (text: string) => void;
  model: ModelType;
  setModel: (v: ModelType) => void;
  dropdown: DropdownType;
  setDropdown: (v: DropdownType | ((prev: DropdownType) => DropdownType)) => void;
  dropdownSearch: string;
  setDropdownSearch: (v: string) => void;
  /** Arquivos que vão junto da próxima mensagem (boleto, nota fiscal...). */
  attachments?: PendingAstroAttachment[];
  onAddFiles?: (files: File[]) => void;
  onRemoveAttachment?: (localId: string) => void;
  isUploadingAttachment?: boolean;
  /** Abre a aba do "+" (Biblioteca, Histórico, anexos). Sem ele, o "+" usa o menu antigo. */
  onOpenPlus?: () => void;
  plusBadgeCount?: number;
  /** Conversa por voz em tempo real (spec 0054). Ausente, o botão usa o reconhecimento de voz do navegador. */
  voiceCall?: {
    isAvailable: boolean;
    status: VoiceCallStatus;
    elapsedSeconds: number;
    isMuted: boolean;
    onStart: () => void;
    onEnd: () => void;
    onToggleMute: () => void;
  };
}

/**
 * Handle imperativo expondo controle de voz pra quem detém o ref
 * (NasaCommandCenter). Usado pra auto-continue: depois do Astro
 * responder por voz, command-center chama startListening pra reabrir
 * o mic sem o user precisar clicar de novo.
 */
export interface CommandInputHandle {
  startListening: () => void;
  isListening: () => boolean;
}

export const CommandInput = forwardRef<
  CommandInputHandle,
  CommandInputProps
>((props, handleRef) => {
  const {
    command,
    setCommand,
    loading,
    onSubmit,
    onVoiceTranscript,
    model,
    setModel,
    dropdown,
    setDropdown,
    dropdownSearch,
    setDropdownSearch,
    attachments = [],
    onAddFiles,
    onRemoveAttachment,
    isUploadingAttachment,
    onOpenPlus,
    plusBadgeCount,
    voiceCall,
  } = props;
  const isVoiceCallActive = Boolean(voiceCall && voiceCall.status !== "idle");
  // Microfone dita no campo; o botão de voz conversa (envia e o ASTRO responde falando).
  type ListeningMode = "dictation" | "conversation";
  const listeningModeRef = useRef<ListeningMode>("conversation");
  const [listeningMode, setListeningModeState] = useState<ListeningMode>("conversation");
  const setListeningMode = useCallback((mode: ListeningMode) => {
    listeningModeRef.current = mode;
    setListeningModeState(mode);
  }, []);
  const commandRef = useRef(command);
  useEffect(() => {
    commandRef.current = command;
  }, [command]);
  const handleTranscript = useCallback(
    (text: string) => {
      if (listeningModeRef.current === "dictation") {
        const current = commandRef.current;
        setCommand(current ? `${current} ${text}` : text);
        return;
      }
      onVoiceTranscript(text);
    },
    [onVoiceTranscript, setCommand],
  );
  const { voiceState, startListening } = useVoiceInput(handleTranscript);
  const { handlePaste, handleDrop, handleDragOver } = useFileDrop(onAddFiles);

  useImperativeHandle(
    handleRef,
    () => ({
      startListening: () => {
        // Só inicia se o browser suporta E não tá ouvindo já
        if (voiceState !== "unsupported" && voiceState !== "listening") {
          setListeningMode("conversation");
          startListening();
        }
      },
      isListening: () => voiceState === "listening",
    }),
    [voiceState, startListening, setListeningMode],
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const syncScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, []);

  useEffect(() => {
    autoResize();
  }, [command, autoResize]);

  // Foco automático sempre — input do explorer fica pronto pra digitar:
  //  - on mount (entrou na área)
  //  - sempre que `loading` solta (acabou de receber resposta)
  // Mantém a "vibe terminal" — usuário não precisa clicar.
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [loading]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [setDropdown]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCommand(val);
    syncScroll();
    const cursor = e.target.selectionStart ?? 0;
    const before = val.slice(0, cursor);
    const slashMatch = before.match(/\/(\w*)$/);
    const hashMatch = before.match(/#(\w[-\w]*)$/);
    if (slashMatch) {
      setDropdown("variable");
      setDropdownSearch(slashMatch[1]);
    } else if (hashMatch) {
      setDropdown("app");
      setDropdownSearch(hashMatch[1]);
    } else if (dropdown === "variable" || dropdown === "app") {
      setDropdown(null);
      setDropdownSearch("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      setDropdown(null);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Destrava audio dentro do gesto do Enter (iOS exige).
      unlockAudio();
      onSubmit();
    }
  };

  const insertVariable = (value: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart ?? 0;
    const before = command.slice(0, cursor);
    const after = command.slice(cursor);
    const newBefore = before.replace(/[/#][\w-]*$/, "") + value + " ";
    setCommand(newBefore + after);
    setDropdown(null);
    setDropdownSearch("");
    setTimeout(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = newBefore.length;
    }, 0);
  };

  const highlightedHTML = buildHighlightedHTML(command);
  const hasContent = Boolean(command.trim()) || attachments.length > 0;
  const canSubmit = hasContent && !loading && !isUploadingAttachment;

  const startDictation = () => {
    setListeningMode("dictation");
    unlockAudio();
    startListening();
  };
  const startVoiceConversation = () => {
    if (voiceCall) {
      unlockAudio();
      voiceCall.onStart();
      return;
    }
    // iOS só libera áudio dentro do gesto: destrava aqui para o ASTRO poder responder falando.
    setListeningMode("conversation");
    unlockAudio();
    startListening();
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div
        data-home-composer
        className="relative overflow-visible rounded-[28px] bg-card/75 shadow-lg backdrop-blur-md transition-all"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <CommandAttachmentList
          attachments={attachments}
          onRemoveAttachment={onRemoveAttachment}
        />
        {isVoiceCallActive && voiceCall && (
          <VoiceCallPanel
            status={voiceCall.status}
            elapsedSeconds={voiceCall.elapsedSeconds}
            isMuted={voiceCall.isMuted}
            onToggleMute={voiceCall.onToggleMute}
            onEnd={voiceCall.onEnd}
          />
        )}
        {/* Texto com destaque de variáveis por baixo do textarea transparente. */}
        <div className={cn("relative w-full", isVoiceCallActive && "hidden")}>
          <div
            ref={highlightRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden px-5 pt-4 pb-2 font-sans text-base leading-relaxed whitespace-pre-wrap wrap-break-word text-foreground"
            style={{ wordBreak: "break-word" }}
            dangerouslySetInnerHTML={{ __html: highlightedHTML + "\u200b" }}
          />
          <textarea
            ref={textareaRef}
            data-nasa-command
            value={command}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onScroll={syncScroll}
            disabled={loading}
            rows={1}
            placeholder="Fala comandante, quais as ordens?"
            className="relative max-h-[200px] min-h-[52px] w-full resize-none overflow-y-auto bg-transparent px-5 pt-4 pb-2 font-sans text-base leading-relaxed text-transparent caret-foreground outline-none selection:bg-info/30 selection:text-transparent placeholder:text-muted-foreground"
            style={{ wordBreak: "break-word" }}
          />
        </div>

        <div className={cn("flex items-center justify-between gap-2 px-3 pt-1 pb-3", isVoiceCallActive && "hidden")}>
          <div className="flex min-w-0 items-center gap-2">
            {onOpenPlus ? (
              <button
                type="button"
                onClick={onOpenPlus}
                aria-label="Mais opções"
                className="relative grid size-10 shrink-0 place-items-center rounded-full bg-knob text-foreground transition-colors hover:bg-accent"
              >
                <Plus className="size-5" />
                {Boolean(plusBadgeCount) && (
                  <span className="absolute top-0.5 right-0.5 size-2.5 rounded-full bg-destructive ring-2 ring-card" />
                )}
              </button>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdown((current) => (current === "plus" ? null : "plus"))}
                  aria-label="Anexar"
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-knob text-foreground transition-colors hover:bg-accent"
                >
                  <Plus className="size-5" />
                </button>
                {dropdown === "plus" && <PlusMenu onClose={() => setDropdown(null)} />}
              </div>
            )}
            <ModelSelector />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={startDictation}
              disabled={loading || voiceState === "unsupported"}
              aria-label={voiceState === "listening" ? "Parar de ouvir" : "Ditar"}
              title={
                voiceState === "unsupported"
                  ? "Navegador não suporta reconhecimento de voz"
                  : voiceState === "listening"
                    ? "Ouvindo... clique para parar"
                    : "Ditar no campo"
              }
              className={cn(
                "grid size-10 place-items-center rounded-full transition-all disabled:opacity-40",
                voiceState === "listening" && listeningMode === "dictation"
                  ? "animate-pulse bg-destructive/20 text-destructive"
                  : "bg-knob text-foreground hover:bg-accent",
              )}
            >
              {voiceState === "listening" && listeningMode === "dictation" ? (
                <MicOff className="size-4" />
              ) : (
                <Mic className="size-4" />
              )}
            </button>

            {hasContent ? (
              <button
                type="button"
                onClick={() => {
                  // Destrava áudio no gesto do envio — com saída em áudio, o ASTRO fala mesmo sem entrada por voz.
                  unlockAudio();
                  onSubmit();
                }}
                disabled={!canSubmit}
                aria-label="Enviar"
                className="grid size-11 place-items-center rounded-full bg-foreground text-background transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                {loading ? <OrbitaSpinner className="size-4 " /> : <ArrowUp className="size-5" />}
              </button>
            ) : voiceCall && !voiceCall.isAvailable ? null : (
              <button
                type="button"
                onClick={startVoiceConversation}
                disabled={loading || voiceState === "unsupported"}
                aria-label="Conversar por voz"
                title="Conversar por voz com o ASTRO"
                className={cn(
                  "grid size-11 place-items-center rounded-full bg-foreground text-background transition-transform hover:scale-105 active:scale-95 disabled:opacity-40",
                  voiceState === "listening" && listeningMode === "conversation" && "animate-pulse",
                )}
              >
                <AudioLines className="size-5" />
              </button>
            )}
          </div>
        </div>

        {dropdown === "variable" && (
          <div className="absolute bottom-full left-3 z-50 mb-1">
            <VariableDropdown search={dropdownSearch} onSelect={insertVariable} />
          </div>
        )}
        {dropdown === "app" && (
          <div className="absolute bottom-full left-3 z-50 mb-1">
            <AppDropdown search={dropdownSearch} onSelect={insertVariable} />
          </div>
        )}
      </div>
      <AstroUsageMeter className="absolute top-full left-0" />
    </div>
  );
});
CommandInput.displayName = "CommandInput";
