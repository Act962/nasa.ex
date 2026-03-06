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
import { ParticipantsSwitcher } from "./participant-switcher";
import { TagsFilter } from "./tags-filter";
import { TemperatureFilter } from "./temperature-filter";
import { WinLossFilter } from "./win-loss-filter";
import { CalendarFilter } from "./calendar-filter";

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

        <div className="flex flex-col gap-2 px-4">
          <ParticipantsSwitcher />
          <TagsFilter />
          <TemperatureFilter />
          <WinLossFilter />
          <CalendarFilter />
        </div>
      </SheetContent>
    </Sheet>
  );
}
