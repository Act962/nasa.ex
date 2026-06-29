import React, { useState } from "react";
import { ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import { exampleCategories } from "../data/constants";

interface ExampleLibraryProps {
  onSelect: (example: string) => void;
}

export function ExampleLibrary({ onSelect }: ExampleLibraryProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full flex flex-col items-center">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors"
      >
        <Lightbulb className="w-3.5 h-3.5" />
        Biblioteca de Exemplos
        {open ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          {exampleCategories.map((cat) => (
            <div key={cat.label}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">{cat.emoji}</span>
                <h4 className="text-xs font-semibold text-zinc-400">
                  {cat.label}
                </h4>
              </div>
              <div className="space-y-1.5">
                {cat.examples.map((example, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      onSelect(example);
                      setOpen(false);
                    }}
                    className="w-full text-left text-xs text-zinc-500 hover:text-zinc-200 bg-zinc-900/50 hover:bg-zinc-800/80 border border-zinc-800/80 hover:border-zinc-700 rounded-lg px-3 py-2 transition-all leading-relaxed"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
