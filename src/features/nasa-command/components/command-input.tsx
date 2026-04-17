import React, { useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Plus, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceInput } from "../hooks/use-voice-input";
import { ModelSelector } from "./model-selector";
import { VariableDropdown } from "./variable-dropdown";
import { AppDropdown } from "./app-dropdown";
import { PlusMenu } from "./plus-menu";
import { DropdownType, ModelType } from "../types";
import { buildHighlightedHTML } from "../utils";

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
}

export function CommandInput({
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
}: CommandInputProps) {
  const { voiceState, startListening } = useVoiceInput(onVoiceTranscript);
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

  return (
    <div ref={wrapperRef} className="relative">
      <style>{`
        @keyframes explorerBorder {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .explorer-border {
          background: linear-gradient(
            270deg,
            #7C3AED,
            #9333ea,
            #a855f7,
            #EC4899,
            rgba(255, 255, 255, 0.92),
            #EC4899,
            #a855f7,
            #7C3AED
          );
          background-size: 600% 600%;
          animation: explorerBorder 5s ease infinite;
        }
      `}</style>

      {/* Animated gradient border + float effect */}
      <div
        className="relative rounded-2xl explorer-border"
        style={{ padding: 1 }}
      >
        <div className="relative bg-zinc-900 rounded-[calc(1rem-1px)] overflow-visible transition-all">
          {/* Text area with highlight */}
          <div className="relative w-full">
            <div
              ref={highlightRef}
              aria-hidden="true"
              className="absolute inset-0 px-4 pt-4 pb-3 font-sans text-sm leading-relaxed pointer-events-none overflow-hidden whitespace-pre-wrap wrap-break-word"
              style={{
                fontSize: "0.875rem",
                lineHeight: "1.625",
                wordBreak: "break-word",
              }}
              dangerouslySetInnerHTML={{ __html: highlightedHTML + "\u200b" }}
            />
            <textarea
              ref={textareaRef}
              data-nasa-command
              value={command}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onScroll={syncScroll}
              disabled={loading}
              rows={1}
              placeholder="Fala comandante, quais as ordens?"
              className="relative w-full px-4 pt-4 pb-3 font-sans bg-transparent text-transparent caret-white resize-none outline-none text-sm leading-relaxed placeholder:text-zinc-600 placeholder:font-sans placeholder:text-xs min-h-[48px] max-h-[200px] overflow-y-auto selection:bg-purple-500/30 selection:text-transparent"
              style={{
                caretColor: "white",
                fontSize: "0.875rem",
                lineHeight: "1.625",
                wordBreak: "break-word",
              }}
            />
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-800/60">
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() =>
                    setDropdown((d) => (d === "plus" ? null : "plus"))
                  }
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 text-zinc-400 hover:text-white transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
                {dropdown === "plus" && (
                  <PlusMenu onClose={() => setDropdown(null)} />
                )}
              </div>

              {/* ── Mic button ── */}
              <button
                type="button"
                onClick={startListening}
                disabled={loading || voiceState === "unsupported"}
                title={
                  voiceState === "unsupported"
                    ? "Navegador não suporta reconhecimento de voz"
                    : voiceState === "listening"
                      ? "Ouvindo... clique para parar"
                      : "Falar comando"
                }
                className={cn(
                  "w-7 h-7 flex items-center justify-center rounded-lg border transition-all",
                  voiceState === "listening"
                    ? "bg-red-500/20 border-red-500/60 text-red-400 animate-pulse"
                    : voiceState === "processing"
                      ? "bg-violet-500/20 border-violet-500/60 text-violet-400"
                      : voiceState === "unsupported"
                        ? "bg-zinc-800 border-zinc-700/50 text-zinc-600 cursor-not-allowed opacity-40"
                        : "bg-zinc-800 hover:bg-zinc-700 border-zinc-700/50 text-zinc-400 hover:text-white",
                )}
              >
                {voiceState === "listening" ? (
                  <MicOff className="w-3.5 h-3.5" />
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <ModelSelector value={model} onChange={setModel} />
              <button
                onClick={onSubmit}
                disabled={!command.trim() || loading}
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                  command.trim() && !loading
                    ? "bg-white text-black hover:bg-zinc-100"
                    : "bg-zinc-800 text-zinc-600 cursor-not-allowed",
                )}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Dropdowns */}
          {dropdown === "variable" && (
            <div className="absolute left-3 bottom-full mb-1 z-50">
              <VariableDropdown
                search={dropdownSearch}
                onSelect={insertVariable}
              />
            </div>
          )}
          {dropdown === "app" && (
            <div className="absolute left-3 bottom-full mb-1 z-50">
              <AppDropdown search={dropdownSearch} onSelect={insertVariable} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
