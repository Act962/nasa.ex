"use client";

import { Column, Lead } from "../list-column";
import { CardTracking } from "../card/card";
import { useSortable, SortableContext } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo } from "react";
import { HeaderColumnKanban } from "./header-column/header";
import { ButtonAddLead } from "./button-add-task";

interface ColumnProps {
  id: string;
  columnId: string;
  name: string;
  color: string;
  leads: Lead[];
  index: number;
}

export function ColumnTracking({ columnId, name, leads, index }: ColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: columnId,
    data: {
      type: "Column",
      column: { columnId, name, leads },
    },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const leadsIds = useMemo(() => leads.map((lead) => lead.id), [leads]);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="w-[272px] select-none max-h-[calc(100vh-7rem)] h-full rounded-2xl bg-foreground/5 flex flex-col justify-between"
    >
      <HeaderColumnKanban
        leads={leads}
        name={name}
        attributes={attributes}
        listeners={listeners}
        id={columnId}
      />
      {/* Corpo (lista de leads rolável) */}
      <div className=" overflow-y-auto overflow-x-hidden p-2 scroll-cols-tracking h-full">
        <SortableContext items={leadsIds}>
          {leads.map((lead, index) => (
            <div className="gap-2 mt-2" key={lead.id}>
              <CardTracking
                leadId={lead.id}
                name={lead.name}
                columnId={lead.statusId}
                index={index}
                // tags={lead.tags}
              />
            </div>
          ))}
        </SortableContext>
      </div>
      {/* Rodapé */}
      <ButtonAddLead columnId={columnId} />
      {/* Cabeçalho */}
    </li>
  );
}
