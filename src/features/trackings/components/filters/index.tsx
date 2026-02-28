"use client";

import { Button } from "@/components/ui/button";
import { Ellipsis, PlusIcon } from "lucide-react";
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
import AddLeadSheet from "@/features/trackings/components/modal/add-lead-sheet";
import { useAddLead } from "@/hooks/modal/use-add-lead";

export function FiltersTracking() {
  const { trackingId } = useParams<{ trackingId: string }>();
  const useLeadSheet = useAddLead();

  return (
    <>
      <div className="flex justify-between items-center px-4 py-2 gap-2 border-b border-border mb-2">
        <div className="flex items-center gap-x-2">
          <div className="hidden sm:flex items-center gap-x-2">
            <TrackingSwitcher />
            <ParticipantsSwitcher />
            <TagsFilter />
            {/* <TemperatureFilter /> */}
            {/* <WinLossFilter /> */}
            <CalendarFilter />
          </div>
          <Filters />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => useLeadSheet.setIsOpen(true)}>
            <PlusIcon className="size-4" />
            Novo Lead
          </Button>

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

      <AddLeadSheet
        trackingId={trackingId}
        open={useLeadSheet.isOpen}
        onOpenChange={useLeadSheet.setIsOpen}
      />
    </>
  );
}
