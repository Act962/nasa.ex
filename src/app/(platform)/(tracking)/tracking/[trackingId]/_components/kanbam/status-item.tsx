"use client";

import { cn } from "@/lib/utils";
import { LeadForm } from "./lead-form";
import { StatusHeader } from "./status-header";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LeadItem } from "./lead-item";

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

interface StatusItemProps {
  data: {
    id: string;
    name: string;
    color: string | null;
    order: number;
    trackingId: string;
    leads: Lead[];
  };
  index: number;
}
export const StatusItem = ({ data, index }: StatusItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: data.id,
    data: {
      type: "Column",
      column: data,
    },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "shrink-0 w-68 h-full flex flex-col select-none",
        isDragging && "z-50",
        index === 0 && "ml-4"
      )}
    >
      <div className="flex flex-col flex-1 min-h-0 rounded-md bg-muted/80 shadow-md pb-2">
        <StatusHeader
          data={data}
          attributes={attributes}
          listeners={listeners}
        />
        <ScrollArea className="flex-1 min-h-0">
          <ol
            className={cn(
              "mx-1 px-1 py-0.5 flex flex-col gap-y-2",
              data.leads.length > 0 ? "mt-2" : "mt-0"
            )}
          >
            <SortableContext items={data.leads.map((col) => col.id)}>
              {data.leads.map((lead) => (
                <LeadItem key={lead.id} data={lead} />
              ))}
            </SortableContext>
          </ol>
        </ScrollArea>
        <LeadForm statusId={data.id} />
      </div>
    </li>
  );
};
