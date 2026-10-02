import React from "react";
import { Image, Link2 } from "lucide-react";

interface PlusMenuProps {
  onClose: () => void;
}

export function PlusMenu({ onClose }: PlusMenuProps) {
  return (
    <div className="absolute bottom-full left-0 mb-2 w-48 bg-card border border-line/60 rounded-xl shadow-2xl overflow-hidden z-50">
      <div className="px-3 py-2 border-b border-line">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Anexar
        </p>
      </div>
      <button
        onClick={onClose}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:bg-card transition-colors"
      >
        <Image className="w-4 h-4 text-muted-foreground" />
        Arquivos &amp; Fotos
      </button>
      <button
        onClick={onClose}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:bg-card transition-colors"
      >
        <Link2 className="w-4 h-4 text-muted-foreground" />
        Links
      </button>
    </div>
  );
}
