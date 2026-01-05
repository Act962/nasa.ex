import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ListFilter } from "lucide-react";

export function Filters() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon-sm" variant="ghost">
          <ListFilter className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent hideOverlay>
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>
            Aplique filtros para refinar sua busca.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
}
