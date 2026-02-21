"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTags } from "@/features/tags/hooks/use-tags";
import { cn } from "@/lib/utils";
import { Check, Plus, X } from "lucide-react";
import { useState } from "react";

export interface EditingTagComponentProps {
  selectedTagIds: string[];
  onSubmit: (tagIds: string[]) => void;
  onCancel?: () => void;
  trackingId: string;
}

export const InputEditTag = ({
  selectedTagIds,
  onSubmit,
  onCancel,
  trackingId,
}: EditingTagComponentProps) => {
  const [localTagIds, setLocalTagIds] = useState<string[]>(selectedTagIds);
  const [open, setOpen] = useState(false);
  const { tags, isLoadingTags } = useTags({ trackingId });

  const handleToggleTag = (tagId: string) => {
    setLocalTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  const handleSave = () => {
    onSubmit(localTagIds);
    setOpen(false); // Close popover on save
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div
            className={cn(
              "flex flex-wrap gap-1 min-h-9 p-1.5 border rounded-md cursor-pointer hover:bg-accent/50 transition-colors",
              open && "ring-1 ring-ring border-primary",
            )}
          >
            {localTagIds.length === 0 && (
              <span className="text-xs text-muted-foreground px-2 py-0.5">
                Selecionar tags...
              </span>
            )}
            {localTagIds.map((tagId) => {
              const tag = tags.find((t) => t.id === tagId);
              if (!tag) return null;
              return (
                <Badge
                  key={tagId}
                  variant="secondary"
                  className="text-[10px] h-5 gap-1 pr-1"
                  style={{
                    backgroundColor: tag.color ? `${tag.color}20` : undefined,
                    borderColor: tag.color ? `${tag.color}40` : undefined,
                  }}
                >
                  {tag.name}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleTag(tagId);
                    }}
                    className="hover:bg-foreground/10 rounded-full p-0.5"
                  >
                    <X className="size-2" />
                  </button>
                </Badge>
              );
            })}
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
        >
          <Command className="w-full">
            <CommandInput
              placeholder="Buscar tag..."
              className="h-8"
              autoFocus
            />
            <CommandList>
              <CommandEmpty>Nenhuma tag encontrada.</CommandEmpty>
              <CommandGroup>
                {tags.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    onSelect={() => handleToggleTag(tag.id)}
                    className="text-xs"
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-secondary",
                        localTagIds.includes(tag.id)
                          ? "bg-secondary text-secondary"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                    >
                      <Check className={cn("h-3 w-3")} />
                    </div>

                    <span>{tag.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <div className="flex justify-end gap-2 mt-1">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button size="sm" onClick={handleSave}>
          Salvar
        </Button>
      </div>
    </div>
  );
};
