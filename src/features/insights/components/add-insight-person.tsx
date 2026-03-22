import { CirclePlusIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueryTags } from "@/features/tags/hooks/use-tags";

export function AddInsightPerson() {
  const { tags } = useQueryTags({ trackingId: "ALL" });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex flex-col items-center justify-center gap-2 hover:bg-foreground/10 rounded-md cursor-pointer py-10">
          <CirclePlusIcon className="size-10" />
          Adicionar Insight
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Tags</DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="max-h-40 overflow-y-auto">
                {tags.map((tag) => (
                  <DropdownMenuItem key={tag.id}>{tag.name}</DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
