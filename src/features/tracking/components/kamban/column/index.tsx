"use client";

import { CirclePlus } from "lucide-react";
import { Column } from "../list-column";
import { CardTracking } from "../card/card";
import { useSortable, SortableContext } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useRef } from "react";
import { HeaderColumnKanban } from "./header-column/header";

export function ColumnTracking({ id, title, leads, loading }: Column) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: id,
    data: {
      type: "Column",
      column: { id, title, leads, loading },
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
      className="w-[272px] h-full select-none max-h-[calc(100vh-7rem)] flex flex-col rounded-2xl 
            bg-foreground/5"
    >
      {/* Cabeçalho */}
      <HeaderColumnKanban
        leads={leads}
        title={title}
        attributes={attributes}
        listeners={listeners}
        id={id}
      />
      {/* Corpo (lista de leads rolável) */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 scroll-cols-tracking">
        {leads.length >= 1 && !loading && (
          <SortableContext items={leadsIds}>
            {leads.map((lead) => (
              <div className="gap-2 mt-2" key={lead.id}>
                <CardTracking
                  id={lead.id}
                  name={lead.name}
                  tags={lead.tags}
                  columnId={lead.columnId}
                />
              </div>
            ))}
          </SortableContext>
        )}
      </div>

      {/* Rodapé */}

      <div className="mt-2 py-1.5 flex flex-row justify-center items-center gap-2 rounded-b-lg hover:bg-foreground/10 cursor-pointer transition-colors">
        Adicionar Lead <CirclePlus className="size-4" />
      </div>
    </li>
  );
}
