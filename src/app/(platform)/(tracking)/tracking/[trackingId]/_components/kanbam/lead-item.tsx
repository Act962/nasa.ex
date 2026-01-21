"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpRight, Grip, Mail, Phone, Tag, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { phoneMask } from "@/utils/format-phone";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import dayjs from "dayjs";

type Lead = {
  id: string;
  name: string;
  email: string | null;
  order: number;
  phone: string | null;
  statusId: string;
  tags: string[];
  createdAt: Date;
  responsible: {
    image: string | null;
    email: string;
    name: string;
  } | null;
};

export const LeadItem = ({ data }: { data: Lead }) => {
  const router = useRouter();

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
          onClick={() => router.push(`/contatos/${data.id}`)}
        >
          <ArrowUpRight className="size-4" />
        </Button>
      </div>
      <Separator />
      <div className="flex flex-col px-4 gap-1 text-xs text-muted-foreground py-2">
        <LeadItemContainer>
          <Mail className="size-3" />
          {data.email || "Email@example.com"}
        </LeadItemContainer>
        <LeadItemContainer>
          <Phone className="size-3" />
          {phoneMask(data.phone) || "(00) 00000-0000"}
        </LeadItemContainer>
        {data.tags.length > 0 && (
          <LeadItemContainer>
            <Tag className="size-3" />
            <div className="flex space-x-0.5">
              {data.tags.slice(0, 2).map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
              {data.tags.length > 2 && (
                <Badge
                  key={data.tags.length}
                  className="bg-input rounded-full p-0.5 text-[10px]"
                >
                  +{data.tags.length - 2}
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
};

interface LeadItemContainerProps extends React.ComponentProps<"div"> {}

function LeadItemContainer({ ...props }: LeadItemContainerProps) {
  return <div className="flex flex-row gap-2 items-center" {...props} />;
}
