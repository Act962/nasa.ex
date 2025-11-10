"use client"

import { Badge } from "@/components/ui/badge"
import {
    Card,
    CardAction,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { ArrowUpRight } from 'lucide-react';
import { Lead } from "../list-column";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function CardTracking({ id, name, tags, columnId }: Lead) {

    // Hook do dnd-kit para tornar o card arrastável
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
            type: "Lead",
            lead: { id, name, tags, columnId }
        }
    });

    // Estilo para animação de drag
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
        >
            <Card className="w-full cursor-grab active:cursor-grabbing">
                <CardHeader>
                    <CardTitle>{name}</CardTitle>
                    <CardAction>
                        <ArrowUpRight />
                    </CardAction>
                </CardHeader>
                <CardContent>
                    {tags.length >= 1 && tags.map((tag, index) => (
                        <Badge key={index}>{tag}</Badge>
                    ))}
                </CardContent>
                <CardFooter className="flex-row gap-2">
                    <div>
                        12-06-2006
                    </div>

                </CardFooter>
            </Card>
        </div>
    )
}