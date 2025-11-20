"use client";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpRight, Grip, Mail, Phone, Tag } from "lucide-react";
import { CardOptions } from "./card-options";
import { useLeads } from "@/hooks/use-lead-modal";
import { Button } from "@/components/ui/button";

type Lead = {
  id: string;
  name: string;
  email: string | null;
  order: number;
  phone: string | null;
  statusId: string;
};

export const LeadItem = ({ data }: { data: Lead }) => {
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

  const { onOpen } = useLeads();

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const handleOpenModal = (leadId: string) => {
    onOpen(leadId);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="truncate border-2 border-transparent hover:border-muted text-sm bg-muted rounded-md shadow-sm group"
    >
      <div className="flex items-center justify-between px-3">
        <div className="flex flex-row items-center gap-2">
          <button
            className="touch-none group-hover:flex active:cursor-grabbing cursor-grab hidden"
            {...listeners}
            {...attributes}
          >
            <Grip className="size-4 " />
          </button>
          <Avatar
            className="size-4 group-hover:hidden touch-none"
            {...listeners}
            {...attributes}
          >
            <AvatarImage
              src={"https://github.com/ElFabrica.png"}
              alt="photo user"
            />
          </Avatar>
          <span className="font-medium text-xs">{data.name}</span>
        </div>
        <Button
          size={"sm"}
          variant={"ghost"}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => handleOpenModal(data.id)}
        >
          <ArrowUpRight className="size-4" />
        </Button>
      </div>
      <Separator />
      <div className="flex flex-col px-4 gap-1 text-xs text-muted-foreground py-2">
        <div className="flex flex-row gap-2 items-center">
          <Mail className="size-3" />
          {data.email || "Email@example.com"}
        </div>
        <div className="flex flex-row gap-2 items-center">
          <Phone className="size-3" />
          {data.phone || "(00) 00000-0000"}
        </div>
        <div className="flex flex-row gap-2 items-center">
          <Tag className="size-3" />
          <div className="flex space-x-0.5">
            {Array.from({ length: 3 }).map((_, index) => (
              <Badge key={index} className="size-4 text-[8px]">
                {index}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
