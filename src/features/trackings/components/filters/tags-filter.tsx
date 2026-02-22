"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTags } from "@/features/tags/hooks/use-tags";
import { TagModal } from "@/features/trackings/components/modal/tag-modal";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, SettingsIcon, TagsIcon, XIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useQueryState } from "nuqs";
import { useState } from "react";

export function TagsFilter() {
  const params = useParams<{ trackingId?: string }>();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { tags, isLoadingTags } = useTags({ trackingId: params.trackingId });
  const [search, setSearch] = useState("");

  const createTagMutation = useMutation(
    orpc.tags.createTag.mutationOptions({
      onSuccess: (data) => {
        setSearch("");
        queryClient.invalidateQueries({
          queryKey: orpc.tags.listTags.queryKey({
            input: {
              query: {
                trackingId: data.trackingId ?? "",
              },
            },
          }),
        });
      },
    }),
  );

  const onCreateTag = (name: string) => {
    createTagMutation.mutate({
      name,
      trackingId: params.trackingId,
    });
  };

  const [tagFilter, setTagFilter] = useQueryState("tags");

  // Converte a string da URL em array
  const selectedTags = tagFilter ? tagFilter.split(",") : [];

  const handleTagFilter = (tagName: string) => {
    const isSelected = selectedTags.includes(tagName);

    if (isSelected) {
      // Remove a tag
      const newTags = selectedTags.filter((t) => t !== tagName);
      setTagFilter(newTags.length > 0 ? newTags.join(",") : null);
    } else {
      // Adiciona a tag
      const newTags = [...selectedTags, tagName];
      setTagFilter(newTags.join(","));
    }
  };

  const clearAllFilters = () => {
    setTagFilter(null);
  };

  const selectedCount = selectedTags.length;

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={selectedCount > 0 ? "default" : "outline"}
            className="justify-start"
            size="sm"
          >
            <TagsIcon className="size-4" />
            Tags
            {selectedCount > 0 && (
              <span className="text-xs font-medium">{selectedCount}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-0">
          <Command>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder="Buscar tags..."
            />

            <CommandList>
              <CommandEmpty>
                {isLoadingTags ? (
                  "Carregando tags..."
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2">
                    {!search ? (
                      "Nenhuma tag encontrada."
                    ) : (
                      <div
                        role="button"
                        onClick={() => onCreateTag(search)}
                        className="flex items-center gap-2"
                      >
                        <Plus className="size-4" />
                        Criar tag "{search}"
                      </div>
                    )}
                  </div>
                )}
              </CommandEmpty>
              <CommandGroup>
                {tags.map((tag) => {
                  const isSelected = selectedTags.includes(tag.slug);

                  return (
                    <CommandItem
                      key={tag.id}
                      value={`${tag.name}-${tag.id}`}
                      className="cursor-pointer"
                      onSelect={() => handleTagFilter(tag.slug)}
                    >
                      <Checkbox checked={isSelected} />
                      {tag.name}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
            <CommandSeparator />
            <div className="p-2 flex justify-end items-center gap-2">
              {selectedCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={clearAllFilters}
                >
                  <XIcon className="size-3" />
                  Limpar
                </Button>
              )}
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setOpen(true)}
              >
                <SettingsIcon className="size-4" />
                <span className="sr-only">Configurações</span>
              </Button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>

      <TagModal open={open} onOpenChange={setOpen} />
    </>
  );
}
