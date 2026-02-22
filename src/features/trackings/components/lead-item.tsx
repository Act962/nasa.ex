"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpRight, Grip, Mail, Phone, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { phoneMask } from "@/utils/format-phone";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import dayjs from "dayjs";
import Link from "next/link";
import { memo } from "react";
import { Lead } from "../types";
import { useConstructUrl } from "@/hooks/use-construct-url";

import { useLeadStore } from "../contexts/use-lead";

export const LeadItem = memo(({ data }: { data: Lead }) => {
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
      <div className="flex items-center justify-between px-3">
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
          <span className="font-medium text-xs truncate">
            {data.name.split(" ")[0]}
            {data.name.split(" ").length > 1 && ` ${data.name.split(" ")[1]}`}
          </span>
        </div>

        <Button
          size="icon-xs"
          variant="ghost"
          className="size-7 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
          asChild
          onClick={(e) => e.stopPropagation()}
        >
          <Link href={`/contatos/${data.id}`}>
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </div>
      <Separator />
      <div className="flex flex-col px-4 gap-1 text-xs text-muted-foreground py-2">
        <LeadItemContainer>
          <Mail className="size-3" />
          <span className="truncate max-w-[160px]">
            {data.email || "Email@example.com"}
          </span>
        </LeadItemContainer>
        <LeadItemContainer>
          <Phone className="size-3" />
          {phoneMask(data.phone) || "(00) 00000-0000"}
        </LeadItemContainer>
        {data.leadTags && data.leadTags.length > 0 && (
          <LeadItemContainer>
            <Tag className="size-3" />
            <div className="flex flex-wrap gap-1">
              {data.leadTags.slice(0, 2).map(({ tag }) => (
                <Badge
                  key={tag.id}
                  // variant="outline"
                  className="px-1 py-0 text-[10px] h-4 font-normal"
                  // style={{
                  //   backgroundColor: tag.color ? `${tag.color}15` : undefined,
                  //   color: tag.color || undefined,
                  //   borderColor: tag.color ? `${tag.color}30` : undefined,
                  // }}
                >
                  {tag.name}
                </Badge>
              ))}
              {data.leadTags.length > 2 && (
                <Badge
                  variant="outline"
                  className="px-1 py-0 text-[10px] h-4 font-normal bg-muted"
                >
                  +{data.leadTags.length - 2}
                </Badge>
              )}
            </div>
          </LeadItemContainer>
        )}
      </div>
      <Separator />
      <div className="flex items-center justify-between bg-secondary px-3 py-2">
        <span className="text-xs text-muted-foreground">
          {dayjs(data.createdAt).format("DD/MM/YYYY HH:mm")}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Avatar className="size-4">
              <AvatarImage
                src={
                  data.responsible?.image || "https://github.com/ElFabrica.png"
                }
                alt="photo user"
              />
              <AvatarFallback>
                {data.responsible?.name.split(" ")[0][0]}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>
            <p>{data.responsible?.name}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
});

interface LeadItemContainerProps extends React.ComponentProps<"div"> {}

function LeadItemContainer({ ...props }: LeadItemContainerProps) {
  return (
    <div
      className="flex flex-row gap-2 items-center min-w-0 truncate"
      {...props}
    />
  );
}
