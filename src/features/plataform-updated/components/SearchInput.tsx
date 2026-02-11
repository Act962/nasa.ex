"use client";

import { Search, Mic, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useVoiceRecognition } from "@/features/plataform-updated/hooks/use-voice-recognition";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
}

const SearchInput = ({ value, onChange, onSubmit }: SearchInputProps) => {
  const { isListening, toggleListening } = useVoiceRecognition((text) => {
    onChange(text);
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="w-full max-w-2xl mx-auto"
    >
      <div
        className={cn(
          "search-glow rounded-full bg-secondary/80 backdrop-blur-xl border border-border flex items-center px-5 py-3 gap-3 transition-all duration-300",
          isListening &&
            "border-primary shadow-[0_0_20px_rgba(168,85,247,0.2)]",
        )}
      >
        <Search className="w-5 h-5 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit?.()}
          placeholder={
            isListening ? "Ouvindo..." : "Pesquisar ferramenta N.A.S.A..."
          }
          className="bg-transparent outline-none w-full text-foreground placeholder:text-muted-foreground text-base"
        />
        <div className="flex items-center gap-2 shrink-0">
          <AnimatePresence>
            {value && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => onChange("")}
                className="p-1 hover:bg-muted/50 rounded-full transition-colors"
                type="button"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </motion.button>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={toggleListening}
            className={cn(
              "p-2 rounded-full transition-all duration-300 relative",
              isListening
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted/50",
            )}
            aria-label="Pesquisa por voz"
          >
            {isListening && (
              <motion.span
                layoutId="pulse"
                className="absolute inset-0 rounded-full bg-primary/40"
                animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              />
            )}
            <Mic
              className={cn(
                "w-5 h-5 transition-colors relative z-10",
                isListening
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            />
          </button>
        </div>
      </div>

      {isListening && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-primary text-xs mt-2 font-medium animate-pulse"
        >
          Gravando áudio para pesquisa...
        </motion.p>
      )}
    </motion.div>
  );
};

export default SearchInput;
