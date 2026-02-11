"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

const AstroButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <>
      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="fixed bottom-24 right-4 md:right-8 w-[90vw] max-w-sm z-50"
          >
            <div className="tool-card rounded-2xl overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="bg-linear-to-br from-primary to-accent p-4 flex items-center gap-3">
                <img
                  src={"/astro-avatar.png"}
                  alt="ASTRO"
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-1">
                  <p className="font-display font-bold text-primary-foreground tracking-wide">
                    ASTRO IA
                  </p>
                  <p className="text-xs text-primary-foreground/80">
                    Assistente virtual N.A.S.A
                  </p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-full hover:bg-white/20 transition-colors"
                >
                  <X className="w-5 h-5 text-primary-foreground" />
                </button>
              </div>

              {/* Messages */}
              <div className="h-64 p-4 overflow-y-auto bg-background/95">
                <div className="flex gap-3 mb-4">
                  <img
                    src={"/astro-avatar.png"}
                    alt=""
                    className="w-8 h-8 rounded-full shrink-0"
                  />
                  <div className="bg-secondary rounded-2xl rounded-tl-none px-4 py-2 max-w-[80%]">
                    <p className="text-sm text-foreground">
                      Olá! 👋 Eu sou o ASTRO, sua inteligência artificial. Como
                      posso ajudar você hoje?
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 mb-4">
                  <img
                    src={"/astro-avatar.png"}
                    alt=""
                    className="w-8 h-8 rounded-full shrink-0"
                  />
                  <div className="bg-secondary rounded-2xl rounded-tl-none px-4 py-2 max-w-[80%]">
                    <p className="text-sm text-foreground">
                      Posso te ajudar com preços, ofertas, informações sobre
                      ferramentas ou suporte técnico. É só perguntar! 🚀
                    </p>
                  </div>
                </div>
              </div>

              {/* Input */}
              <div className="p-4 border-t border-border bg-card">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 bg-secondary rounded-full px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <Button size="icon" className="rounded-full shrink-0">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-4 md:right-8 z-50 group"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        animate={{ y: [0, -8, 0] }}
        transition={{
          y: { repeat: Infinity, duration: 3, ease: "easeInOut" },
        }}
      >
        <div className="relative">
          <div className="absolute inset-0 bg-primary/50 rounded-full blur-xl group-hover:bg-primary/70 transition-colors" />
          <div className="relative bg-linear-to-br from-primary to-accent p-1 rounded-full shadow-lg">
            <img
              src={"/astro-avatar.png"}
              alt="Fale com ASTRO"
              className="w-14 h-14 md:w-16 md:h-16 rounded-full"
            />
          </div>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background animate-pulse" />
        </div>
      </motion.button>
    </>
  );
};

export default AstroButton;
