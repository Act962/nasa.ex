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
import { cn } from "@/lib/utils";
import { ParticipantsSwitcher } from "./participant-switcher";
import { TagsFilter } from "./tags-filter";
import { TemperatureFilter } from "./temperature-filter";
import { WinLossFilter } from "./win-loss-filter";
import { CalendarFilter } from "./calendar-filter";
import { SorterLead } from "./sort-leads";
import { ProjectsFilter } from "./projects-filter";
import { StatusFlowFilter } from "./status-flow-filter";

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

        <FiltersPanel className="px-4" />
      </SheetContent>
    </Sheet>
  );
}

export function FiltersPanel({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ParticipantsSwitcher />
      <ProjectsFilter />
      <TagsFilter />
      <TemperatureFilter />
      <StatusFlowFilter />
      <WinLossFilter />
      <CalendarFilter />
      <SorterLead />
    </div>
  );
}
