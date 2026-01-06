"use client";

import { Button } from "@/components/ui/button";
import { Ellipsis, ListFilter } from "lucide-react";
import { TrackingSwitcher } from "./tracking-switcher";
import { ParticipantsSwitcher } from "./participant-switcher";
import { Filters } from "./filters";
import { TagsFilter } from "./tags-filter";
import { CalendarFilter } from "./calendar-filter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useParams } from "next/navigation";

export function FiltersTracking() {
  const { trackingId } = useParams<{ trackingId: string }>();

  return (
    <>
      <div className="flex justify-end sm:justify-between items-center px-4 py-2 gap-2 border-b border-border mb-2">
        <div className="hidden sm:flex items-center gap-x-2">
          <TrackingSwitcher />
          <ParticipantsSwitcher />
          <TagsFilter />
          <CalendarFilter />
        </div>
        <div className="flex items-center gap-2">
          <Filters />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost">
                <Ellipsis className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem role="button" asChild>
                <Link href={`/tracking/${trackingId}/settings`}>
                  Configurações
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  );
}
