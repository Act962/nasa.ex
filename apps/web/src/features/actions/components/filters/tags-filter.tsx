"use client";

import { TagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useListTags } from "@/features/workspace/hooks/use-workspace";
import { useActionFilters } from "../../hooks/use-action-filters";

interface Props {
  workspaceId: string;
  variant?: "popover" | "list";
}

export function TagsFilter({ workspaceId, variant = "popover" }: Props) {
  const { tags } = useListTags(workspaceId);
  const { filters, setFilters } = useActionFilters();

  const toggleTag = (id: string) => {
    const ids = filters.tagIds.includes(id)
      ? filters.tagIds.filter((x) => x !== id)
      : [...filters.tagIds, id];
    setFilters({ ...filters, tagIds: ids });
  };

  const selectedCount = filters.tagIds.length;

  if (tags.length === 0) return null;

  if (variant === "list") {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <TagIcon className="size-4 text-muted-foreground" />
          Etiquetas
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag: any) => {
            const active = filters.tagIds.includes(tag.id);
            return (
              <Badge
                key={tag.id}
                variant={active ? "default" : "outline"}
                className="cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1.5 py-1 px-2.5 h-auto text-[11px]"
                onClick={() => toggleTag(tag.id)}
                style={
                  active
                    ? { backgroundColor: tag.color, color: "#fff" }
                    : { borderColor: tag.color }
                }
              >
                {!active && (
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                )}
                {tag.name}
              </Badge>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={selectedCount > 0 ? "secondary" : "outline"}
          size="sm"
          className="h-7 gap-1.5 text-xs"
        >
          <TagIcon className="size-3" />
          Etiquetas
          {selectedCount > 0 && (
            <Badge className="h-4 min-w-4 px-1 text-[10px]">
              {selectedCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1.5" align="start">
        <p className="text-xs font-medium text-muted-foreground px-1 mb-1.5">
          Filtrar por etiqueta
        </p>
        <div className="space-y-0.5 max-h-72 overflow-y-auto scroll-cols-tracking">
          {tags.map((tag: any) => {
            const active = filters.tagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className="flex items-center gap-2 w-full p-1.5 rounded-md hover:bg-muted transition-colors"
              >
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="flex-1 text-xs text-left">{tag.name}</span>
                {active && (
                  <span className="text-primary text-xs font-bold">✓</span>
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
