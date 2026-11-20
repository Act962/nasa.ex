"use client";

// Etiquetas escolhidas no bloco Etiqueta do FlowAstro (spec 0139): no cartão até `maxVisible` e "+N"; no painel todas, com "x".
import { XIcon } from "lucide-react";
import { useTags } from "@/features/tags/hooks/use-tags";
import { cn } from "@/lib/utils";

const FALLBACK_COLOR = "#94a3b8";

export function TagChips({
  tagIds,
  maxVisible,
  onRemove,
  className,
}: {
  tagIds: string[];
  maxVisible?: number;
  onRemove?: (tagId: string) => void;
  className?: string;
}) {
  const { tags } = useTags();
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));
  const visibleIds = maxVisible === undefined ? tagIds : tagIds.slice(0, maxVisible);
  const hiddenCount = tagIds.length - visibleIds.length;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {visibleIds.map((tagId) => {
        const tag = tagById.get(tagId);
        return (
          <span
            key={tagId}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-foreground"
          >
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: tag?.color ?? FALLBACK_COLOR }} />
            <span className="truncate">{tag?.name ?? "Etiqueta removida"}</span>
            {onRemove && (
              <button
                type="button"
                className="-mr-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Tirar etiqueta"
                onClick={() => onRemove(tagId)}
              >
                <XIcon className="size-3" />
              </button>
            )}
          </span>
        );
      })}
      {hiddenCount > 0 && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground" title={`Mais ${hiddenCount} etiqueta(s)`}>
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}
