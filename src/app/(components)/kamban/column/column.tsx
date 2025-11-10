"use client"

import { Badge } from "@/components/ui/badge";
import { OptionColumn } from "./option";
import { CirclePlus } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { Column } from "../list-column";
import { CardTracking } from "../card/card";
import { useSortable, SortableContext } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo } from "react";
import { Grip } from 'lucide-react';


export function ColumnTracking({ id, title, leads, loading }: Column) {

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: id,
        data: {
            type: "Column",
            column: { id, title, leads, loading }
        }
    });

    const style = {
        transition,
        transform: CSS.Transform.toString(transform),
        opacity: isDragging ? 0.5 : 1,
    };

    const leadsIds = useMemo(() => leads.map((lead) => lead.id), [leads]);

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="w-[350px] h-full max-h-[calc(100vh-4rem)] flex flex-col rounded-lg bg-gray-950"
        >
            {/* Cabeçalho */}
            <header
                className="flex flex-row px-4 py-6 justify-between   bg-gray-950 rounded-t-lg"
            >
                <div className="flex flex-row gap-2 items-center">
                    <Grip
                        className="
                    cursor-grab
                    active:cursor-grabbing 
                    "
                        size={16}
                        {...attributes}
                        {...listeners}
                    />
                    {title}
                    <Badge className="bg-gray-700">{leads.length || 0}</Badge>
                </div>
                <OptionColumn />
            </header>

            {/* Corpo (lista de leads rolável) */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 scroll-cols-tracking">
                {leads.length >= 1 && loading && (
                    <div className="flex flex-col gap-2">
                        <Skeleton />
                        <Skeleton />
                        <Skeleton />
                    </div>
                )}

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

                {leads.length === 0 && (
                    <div className="text-center text-gray-400 py-4">Nada aqui</div>
                )}
            </div>

            {/* Rodapé */}
            <div className="mt-auto py-4 flex flex-row justify-center items-center gap-2 rounded-b-lg hover:bg-gray-900 cursor-pointer">
                Adicionar Lead <CirclePlus />
            </div>
        </div>
    )
}
