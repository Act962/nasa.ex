"use client";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Mail, Phone, Tag } from "lucide-react";
import { CardOptions } from "./card-options";

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

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="truncate border-2 border-transparent hover:border-muted text-sm bg-muted rounded-md shadow-sm group touch-none"
    >
      <div className="flex items-center justify-between px-3 ">
        <div className="flex flex-row items-center gap-2">
          <Avatar className="size-5 ">
            <AvatarImage
              src={"https://github.com/ElFabrica.png"}
              alt="photo user"
            />
          </Avatar>
          <span className="font-medium text-xs">{data.name}</span>
        </div>
        <CardOptions leadId={data.id} statusId={data.statusId} />
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
