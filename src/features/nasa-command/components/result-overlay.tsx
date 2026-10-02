import React, { useState } from "react";
import { CheckCircle2, Copy, ExternalLink, X } from "lucide-react";
import { ResultData } from "../types";

interface ResultOverlayProps {
  result: ResultData;
  onClose: () => void;
}

export function ResultOverlay({ result, onClose }: ResultOverlayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(`${window.location.origin}${result.url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-line/60 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-success/20 border border-success/30 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-white mb-1">
                {result.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {result.description}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <a
              href={result.url}
              className="flex-1 flex items-center justify-center gap-2 bg-white text-black text-sm font-semibold py-2.5 rounded-lg hover:bg-muted transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir agora
            </a>
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 bg-card border border-line text-muted-foreground text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-knob transition-colors"
            >
              <Copy className="w-4 h-4" />
              {copied ? "Copiado!" : "Copiar link"}
            </button>
          </div>
        </div>

        <div className="border-t border-line px-6 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-muted-foreground transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
