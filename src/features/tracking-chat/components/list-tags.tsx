import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Lead } from "@/features/trackings/types";
import { getContrastColor } from "@/utils/get-contrast-color";
import { PlusIcon, Settings, SettingsIcon, TagIcon } from "lucide-react";
import { useAddTagsOptimistic } from "@/features/trackings/hooks/use-leads";
import { useQueryTags } from "@/features/tags/hooks/use-tags";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { toast } from "sonner";
import { TagModal } from "@/features/trackings/components/modal/tag-modal";

interface listTagsProps {
  tags: Lead["leadTags"];
  leadId: string;
  trackingId: string;
}

export function ListTags({ tags, leadId, trackingId }: listTagsProps) {
  return (
    <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
      {tags.slice(0, 6).map(({ tag }) => {
        const textColor = getContrastColor(tag.color || "");
        return (
          <Tooltip key={tag.id}>
            <TooltipTrigger asChild>
              <Badge
                // variant="outline"
                className="px-1 py-0 text-[10px] h-4 font-normal"
                style={{
                  backgroundColor: tag.color ?? undefined,
                  color: textColor,
                }}
              >
                {tag.name}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{tag.name}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
      {tags.length > 6 && (
        <Badge
          variant="outline"
          className="px-1 py-0 text-[10px] h-4 font-normal bg-muted"
        >
          +{tags.length - 6}
        </Badge>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <AddTagsButton
            leadId={leadId}
            existingTagIds={tags.map((lt) => lt.tag.id)}
            trackingId={trackingId}
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>Adicionar tag</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function AddTagsButton({
  leadId,
  existingTagIds,
  trackingId,
}: {
  leadId: string;
  existingTagIds: string[];
  trackingId: string;
}) {
  const [open, setOpen] = useState(false);
  const { tags } = useQueryTags({});
  const [openTagModal, setOpenTagModal] = useState(false);

  const handleOpen = () => {
    setOpen(!open);
  };

  const update = useMutationLeadUpdate(leadId, trackingId);

  const onSelectTag = (tagId: string) => {
    update.mutate(
      {
        tagIds: [...existingTagIds, tagId],
        id: leadId,
      },
      {
        onSuccess: () => {
          toast.success(`Tag adicionada com sucesso`, {
            position: "bottom-right",
          });
          setOpen(false);
        },
        onError: () => {
          toast.error(`Erro ao adicionar tag`, {
            position: "bottom-right",
          });
        },
      },
    );
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleOpen();
            }}
            className="size-4 rounded-full focus-visible:ring-0"
            variant="outline"
          >
            <PlusIcon className="size-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-64 p-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Command>
            <CommandInput placeholder="Adicionar tags..." />
            <CommandList>
              <CommandEmpty>
                <span className="text-sm text-muted-foreground">
                  Nenhuma tag encontrada
                </span>
              </CommandEmpty>
              <CommandGroup className="max-h-60 overflow-y-auto">
                {tags?.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    value={`${tag.name}-${tag.id}`}
                    onSelect={() => onSelectTag(tag.id)}
                    className="cursor-pointer"
                  >
                    <Checkbox checked={existingTagIds.includes(tag.id)} />
                    <TagIcon
                      className="mr-2 h-3.5 w-3.5"
                      style={{ color: tag.color || "", fill: tag.color || "" }}
                    />
                    <span>{tag.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <CommandItem className="border-t flex justify-end p-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenTagModal(true);
                }}
              >
                <SettingsIcon className="size-3" />
              </Button>
            </CommandItem>
          </Command>
        </PopoverContent>
      </Popover>
      <div onClick={(e) => e.stopPropagation()}>
        <TagModal
          trackingId={trackingId}
          open={openTagModal}
          onOpenChange={setOpenTagModal}
        />
      </div>
    </>
  );
}
