AbortSignal
import { Grip } from "lucide-react";
import { OptionColumn } from "./option";
import { DraggableAttributes } from "@dnd-kit/core";
import { Lead } from "../list-column";
import { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { Badge } from "@/components/ui/badge";


interface HeaderColumnKanbanProps {
    leads: Lead[]
    title: string
    attributes: DraggableAttributes
    listeners?: SyntheticListenerMap

}

export function HeaderColumnKanban({ leads, title, attributes, listeners }: HeaderColumnKanbanProps) {
    return <header
        className="flex flex-row px-4 py-6 justify-between  rounded-t-lg">
        <div className="flex flex-row justify-center gap-2 items-center">
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
            <Badge className="bg-foreground/5 text-muted-foreground">{leads.length || 0}</Badge>
        </div>
        <OptionColumn />
    </header>
}