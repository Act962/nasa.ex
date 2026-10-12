"use client";

import { useAtom } from "jotai";
import { cn } from "@/lib/utils";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { editorViewModeAtom, type EditorViewMode } from "../store/atoms";

const VIEW_MODES: { value: EditorViewMode; label: string; title: string }[] = [
  { value: "icon", label: "Ícones", title: "Quadros compactos, só com o ícone" },
  { value: "rich", label: "Visual", title: "Card do lead nos gatilhos e celular nas mensagens" },
];

/** Chave "Ícones / Visual" do editor de fluxos (spec 0090, RF-7). */
export function ViewModeToggle() {
  const [viewMode, setViewMode] = useAtom(editorViewModeAtom);
  return (
    <div className="flex h-8 overflow-hidden rounded-full border bg-background text-xs" data-guide={GUIDE_ANCHORS.workflowViewModeToggle.id}>
      {VIEW_MODES.map((mode) => (
        <button
          key={mode.value}
          type="button"
          title={mode.title}
          aria-pressed={viewMode === mode.value}
          onClick={() => setViewMode(mode.value)}
          className={cn(
            "h-full px-3 transition",
            viewMode === mode.value ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground hover:bg-muted",
          )}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
