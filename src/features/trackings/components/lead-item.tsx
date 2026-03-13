"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowUpRight,
  CheckIcon,
  Grip,
  Mail,
  Phone,
  PlusIcon,
  RocketIcon,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQueryTagByLead } from "@/features/tracking-chat/hooks/use-leads-conversation";
import { Button } from "@/components/ui/button";
import { phoneMaskFull } from "@/utils/format-phone";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import dayjs from "dayjs";
import { memo, useState } from "react";
import { Lead } from "../types";
import { useConstructUrl } from "@/hooks/use-construct-url";

import { useLeadStore } from "../contexts/use-lead";
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
import { useQueryTags } from "@/features/tags/hooks/use-tags";
import { useParams, useRouter } from "next/navigation";
import {
  useAddTagsOptimistic,
  useRemoveTagOptimistic,
} from "../hooks/use-leads";
import { cn } from "@/lib/utils";
import { CheckIaLead } from "@/features/tracking-chat/components/check-ia-lead";
import { getContrastColor } from "@/utils/get-contrast-color";

const TEMP_COLOR = {
  COLD: "#3498db",
  WARM: "#f1c40f",
  HOT: "#e67e22",
  VERY_HOT: "#e74c3c",
} as const;

const TEMP_TEXT = {
  COLD: "Frio",
  WARM: "Quente",
  HOT: "Muito quente",
  VERY_HOT: "Extremamente quente",
} as const;

export const LeadItem = memo(({ data }: { data: Lead }) => {
  const router = useRouter();
  const { toggleLead, isSelected } = useLeadStore();
  const selected = isSelected(data.id);

  const {
    attributes,
    listeners,
    setNodeRef,
    transition,
    transform,
    isDragging,
  } = useSortable({
    id: data.id,
    data: {
      type: "Lead",
      lead: data,
    },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const url = useConstructUrl(data.profile || "");

  const handleSelect = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("a")) return;
    toggleLead(data);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-lead-id={data.id}
      data-order={data.order}
      onClick={handleSelect}
      className={`border-2 text-sm bg-muted rounded-md shadow-sm group cursor-pointer transition-all overflow-hidden ${
        selected ? "border-primary/50" : "border-transparent hover:border-muted"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex flex-row items-center gap-2">
          <button
            className="touch-none group-hover:flex active:cursor-grabbing cursor-grab hidden"
            {...listeners}
            {...attributes}
            onClick={(e) => e.stopPropagation()} // Evita selecionar ao clicar no grid de arrastar
          >
            <Grip className="size-4 " />
          </button>
          <Avatar
            className="size-4 group-hover:hidden touch-none"
            {...listeners}
            {...attributes}
          >
            <AvatarImage src={url} alt="photo user" />
            <AvatarFallback className="text-xs bg-foreground/10 ">
              {data.name.split(" ")[0][0]}
            </AvatarFallback>
          </Avatar>
          <Tooltip>
            <TooltipTrigger>
              <div className="max-w-40 truncate">
                <span className="font-medium text-xs truncate">
                  {data.name || "Sem nome"}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>{data.name || "Sem nome"}</TooltipContent>
          </Tooltip>
        </div>

        <div
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
            onClick={(e) => {
              router.push(`/contatos/${data.id}`);
            }}
          >
            <ArrowUpRight className="size-3.5" />
          </button>
          <CheckIaLead
            size={"xs"}
            active={data.isActive}
            leadId={data.id}
            trackingId={data.trackingId}
          />
        </div>
      </div>
      <Separator />
      <div className="flex flex-col px-4 gap-1 text-xs text-muted-foreground py-2">
        <LeadItemContainer>
          <Mail className="size-3" />
          <span className="truncate max-w-40">
            {data.email || "Email@example.com"}
          </span>
        </LeadItemContainer>
        <LeadItemContainer>
          <Phone className="size-3" />
          {phoneMaskFull(data.phone) || "(00) 00000-0000"}
        </LeadItemContainer>
        <LeadItemContainer className="items-baseline">
          <Tag className="size-3" />
          <ListLeadTags leadId={data.id} tags={data.leadTags} />
        </LeadItemContainer>
      </div>
      <Separator />
      <div
        className="flex items-center justify-between bg-secondary px-3 py-2"
        {...listeners}
        {...attributes}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {dayjs(data.createdAt).format("DD/MM/YYYY HH:mm")}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <RocketIcon
                className="size-3"
                style={{
                  color: TEMP_COLOR[data.temperature],
                }}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>{TEMP_TEXT[data.temperature]}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Avatar className="size-4">
              <AvatarImage
                src={data.responsible?.image || "/user-placeholder.png"}
                alt="photo user"
              />
              <AvatarFallback>
                {data.responsible?.name.split(" ")[0][0]}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>
            {data.responsible?.name || "Sem responsável"}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
});

interface LeadItemContainerProps extends React.ComponentProps<"div"> {}

function LeadItemContainer({ className, ...props }: LeadItemContainerProps) {
  return (
    <div
      className={cn(
        "flex flex-row gap-2 items-center min-w-0 truncate max-w-full",
        className,
      )}
      {...props}
    />
  );
}

function ListLeadTags({ leadId, tags }: { leadId: string; tags: any[] }) {
  const { tags: leadTags } = useQueryTagByLead(
    leadId,
    tags.map((t) => t.tag),
  );

  return (
    <div className="flex flex-wrap gap-1 w-full">
      {leadTags && leadTags.length > 0 && (
        <>
          {leadTags.slice(0, 8).map((tag) => (
            <Tooltip key={tag.id}>
              <TooltipTrigger asChild>
                <Badge
                  className="px-1 py-0 text-[10px] h-4 font-normal max-w-50 inline-block truncate"
                  style={{
                    backgroundColor: tag.color || "#000000",
                    color: getContrastColor(tag.color || "#000000"),
                  }}
                >
                  {tag.name}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{tag.name}</TooltipContent>
            </Tooltip>
          ))}
          {leadTags.length > 8 && (
            <Badge
              variant="outline"
              className="px-1 py-0 text-[10px] h-4 font-normal bg-muted"
            >
              +{leadTags.length - 8}
            </Badge>
          )}
        </>
      )}
      <AddTagsButton
        leadId={leadId}
        existingTagIds={leadTags?.map((lt) => lt.id) || []}
      />
    </div>
  );
}

function AddTagsButton({
  leadId,
  existingTagIds,
}: {
  leadId: string;
  existingTagIds: string[];
}) {
  const { trackingId } = useParams<{ trackingId: string }>();
  const [open, setOpen] = useState(false);
  const { tags } = useQueryTags({ trackingId });

  const handleOpen = () => {
    setOpen(!open);
  };

  const addTags = useAddTagsOptimistic({ leadId, trackingId });
  const removeTags = useRemoveTagOptimistic({ leadId });

  const onSelectTag = (tagId: string) => {
    if (existingTagIds.includes(tagId)) {
      removeTags.mutate({ leadId, tagIds: [tagId] });
      return;
    }

    addTags.mutate(
      {
        leadId,
        tagIds: [tagId],
      },
      {
        onSuccess: () => {
          setOpen(false);
        },
      },
    );
  };

  return (
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
            <CommandGroup>
              {tags?.map((tag) => {
                const isTagSelected = existingTagIds.includes(tag.id);

                return (
                  <CommandItem
                    key={tag.id}
                    value={`${tag.name}-${tag.id}`}
                    onSelect={() => onSelectTag(tag.id)}
                    className="cursor-pointer"
                  >
                    <Tag
                      className="mr-2 size-3.5"
                      style={{ color: tag.color || "", fill: tag.color || "" }}
                    />
                    <span>{tag.name}</span>
                    {isTagSelected && <CheckIcon className="ml-auto size-4" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
