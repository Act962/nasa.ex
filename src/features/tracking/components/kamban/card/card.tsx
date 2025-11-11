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
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { ToggleLeft } from 'lucide-react';
import { User } from 'lucide-react';

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
            className="touch-none"
        >
            <Card className="w-full cursor-grab active:cursor-grabbing gap-3 py-2 ">
                <CardHeader className=" flex justify-between px-3">
                    <div className="flex flex-row items-center gap-3 ">
                        <Avatar>
                            <AvatarImage src="https://github.com/shadcn.png" />
                        </Avatar>
                        <CardTitle>{name}</CardTitle>
                    </div>
                    <CardAction className="flex flex-row items-center justify-center opacity-90 gap-2">
                        <ToggleLeft size={20} />
                        <ArrowUpRight size={20} />
                    </CardAction>
                </CardHeader>
                <CardContent
                    className="px-3"
                >
                    {tags.length >= 1 && tags.map((tag, index) => (
                        <Badge className="mr-1"
                            key={index}>{tag}</Badge>
                    ))}
                </CardContent>
                <CardFooter
                    className="flex-row gap-2 px-3
                
                ">
                    <div className="flex flex-row justify-between w-full">
                        12-06-2006
                        <User size={20} />
                    </div>
                </CardFooter>
            </Card>
        </div>
    )
}