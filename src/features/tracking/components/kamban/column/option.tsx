import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { EllipsisVertical } from 'lucide-react';
import { Pencil } from 'lucide-react';



export function OptionColumn() {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <EllipsisVertical
                    size={16}
                    className="cursor-pointer" />
            </PopoverTrigger>
            <PopoverContent className="w-40 flex flex-row gap-2">
                <Pencil className="size-4" />
                <h4 className="leading-none font-medium">
                    Editar Item
                </h4>
            </PopoverContent>
        </Popover>
    )
}
