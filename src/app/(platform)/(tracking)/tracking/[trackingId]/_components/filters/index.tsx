"use client";

import { Button } from "@/components/ui/button";
import { Ellipsis, ListFilter } from "lucide-react";
import { TrackingSwitcher } from "./tracking-switcher";
import { ParticipantsSwitcher } from "./participant-switcher";
import { Filters } from "./filters";
import { TagsFilter } from "./tags-filter";
import { CalendarFilter } from "./calendar-filter";

export function FiltersTracking() {
  return (
    <>
      <div className="flex justify-between items-center px-4 py-2 gap-2 border-b border-border mb-2">
        <div className="flex items-center gap-x-2">
          <TrackingSwitcher />
          <ParticipantsSwitcher />
          <TagsFilter />
          <CalendarFilter />
        </div>
        <div className="flex items-center gap-2">
          <Filters />
          <Button size="icon-sm" variant="ghost">
            <Ellipsis className="size-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
