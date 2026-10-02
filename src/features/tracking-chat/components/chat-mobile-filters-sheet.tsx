"use client";

import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { orpc } from "@/lib/orpc";
import { ConversationFiltersContent } from "./conversation-filters-panel";

interface ChatMobileFiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackingId: string | null;
  selectedTagIds: string[];
  onSelectedTagIdsChange: (tagIds: string[]) => void;
}

/** Gaveta de filtros do Chat no celular: filtros avançados + etiquetas, aberta pelo dock. */
export function ChatMobileFiltersSheet({
  open,
  onOpenChange,
  trackingId,
  selectedTagIds,
  onSelectedTagIdsChange,
}: ChatMobileFiltersSheetProps) {
  const { data: tagData, isLoading: isLoadingTags } = useQuery({
    ...orpc.tags.listTags.queryOptions({
      input: { query: { trackingId: trackingId ?? undefined } },
    }),
    enabled: open && !!trackingId,
  });
  const tags = tagData?.tags ?? [];

  const toggleTag = (tagId: string) =>
    onSelectedTagIdsChange(
      selectedTagIds.includes(tagId)
        ? selectedTagIds.filter((selectedId) => selectedId !== tagId)
        : [...selectedTagIds, tagId],
    );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Refine a lista de conversas.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4">
          <div>
            <ConversationFiltersContent trackingId={trackingId} />
          </div>

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-muted-foreground">Etiquetas</span>
              {selectedTagIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => onSelectedTagIdsChange([])}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Limpar
                </button>
              )}
            </div>
            {!trackingId ? (
              <p className="px-1 text-xs text-muted-foreground">Selecione um tracking primeiro.</p>
            ) : isLoadingTags ? (
              <p className="px-1 text-xs text-muted-foreground">Carregando etiquetas...</p>
            ) : tags.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">Nenhuma etiqueta encontrada.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {tags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex cursor-pointer items-center gap-3 rounded-full px-3 py-2 text-sm hover:bg-accent"
                  >
                    <Checkbox
                      checked={selectedTagIds.includes(tag.id)}
                      onCheckedChange={() => toggleTag(tag.id)}
                    />
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: tag.color ?? "currentColor" }}
                    />
                    <span className="truncate">{tag.name}</span>
                  </label>
                ))}
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
