import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowDownWideNarrowIcon } from "lucide-react";
import { useKanbanStore } from "../../lib/kanban-store";
import { useSidebar } from "@/components/ui/sidebar";

export function SorterLead() {
  const { isMobile } = useSidebar();

  const { sortBy, setSortBy } = useKanbanStore();
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button className="justify-start" variant="outline" size={"sm"}>
          <ArrowDownWideNarrowIcon className="size-4" />
          Ordenar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-50" align={isMobile ? "end" : "start"}>
        <DropdownMenuItem onClick={() => setSortBy("order")}>
          {sortBy === "order" && "✓ "}Personalizada (Padrão)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setSortBy("createdAt")}>
          {sortBy === "createdAt" && "✓ "}Data de chegada
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setSortBy("updatedAt")}>
          {sortBy === "updatedAt" && "✓ "}Data de interação
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
