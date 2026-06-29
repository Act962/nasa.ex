import React from "react";
import { Image, Link2 } from "lucide-react";

interface PlusMenuProps {
  onClose: () => void;
}

export function PlusMenu({ onClose }: PlusMenuProps) {
  return (
    <div className="absolute bottom-full left-0 mb-2 w-48 bg-zinc-900 border border-zinc-700/60 rounded-xl shadow-2xl overflow-hidden z-50">
      <div className="px-3 py-2 border-b border-zinc-800">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
          Anexar
        </p>
      </div>
      <button
        onClick={onClose}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
      >
        <Image className="w-4 h-4 text-zinc-400" />
        Arquivos &amp; Fotos
      </button>
      <button
        onClick={onClose}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
      >
        <Link2 className="w-4 h-4 text-zinc-400" />
        Links
      </button>
    </div>
  );
}
