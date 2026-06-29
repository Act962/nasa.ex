"use client";

import { useState } from "react";
import { TagIcon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SidebarField } from "./sidebar-field";
import {
  useListTags,
  useAddTagToAction,
  useRemoveTagFromAction,
} from "@/features/workspace/hooks/use-workspace";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Props {
  actionId: string;
  workspaceId: string;
  tags: { tag: Tag }[];
  disabled?: boolean;
}

export function TagsField({
  actionId,
  workspaceId,
  tags = [],
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const { tags: availableTags } = useListTags(workspaceId);
  const addTag = useAddTagToAction();
  const removeTag = useRemoveTagFromAction();

  const assignedTagIds = new Set(tags.map((t) => t.tag.id));

  const handleToggle = (tagId: string) => {
    if (assignedTagIds.has(tagId)) {
      removeTag.mutate({ actionId, tagId });
    } else {
      addTag.mutate({ actionId, tagId });
    }
  };

  return (
    <SidebarField label="Etiquetas" icon={<TagIcon className="size-3.5" />}>
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {tags.map(({ tag }) => (
          <Badge
            key={tag.id}
            className="h-5 px-1.5 text-[10px] gap-1 cursor-default pr-0.5"
            style={{
              backgroundColor: tag.color + "33",
              color: tag.color,
              borderColor: tag.color + "66",
            }}
            variant="outline"
          >
            {tag.name}
            {!disabled && (
              <button
                onClick={() => handleToggle(tag.id)}
                className="ml-0.5 rounded-full hover:opacity-70"
              >
                <XIcon className="size-2.5" />
              </button>
            )}
          </Badge>
        ))}

        {!disabled && availableTags.length > 0 && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-5 px-1.5 text-[10px] border-dashed"
              >
                <PlusIcon className="size-2.5 mr-0.5" />
                Etiqueta
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-1.5" align="start">
              <p className="text-xs font-medium text-muted-foreground px-1 mb-1.5">
                Selecionar etiquetas
              </p>
              <div
                className="space-y-0.5 min-h-0 max-h-52 overflow-y-auto scroll-cols-tracking"
                onWheel={(e) => e.stopPropagation()}
              >
                {availableTags.map((tag: Tag) => {
                  const isActive = assignedTagIds.has(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => handleToggle(tag.id)}
                      className="flex items-center gap-2 w-full p-1.5 rounded-md hover:bg-muted transition-colors text-left"
                    >
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1 text-xs">{tag.name}</span>
                      {isActive && (
                        <span className="size-3.5 text-primary text-xs font-bold">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {tags.length === 0 && availableTags.length === 0 && (
          <span className="text-xs text-muted-foreground">Sem etiquetas</span>
        )}
      </div>
    </SidebarField>
  );
}
