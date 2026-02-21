import { CircleCheckIcon, CircleIcon, RedoDotIcon, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";
import { useQueryStatus, useQueryTrackings } from "../hooks/use-trackings";
import { useLeadStore } from "../contexts/use-lead";
import { useParams } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";
import { useMutationUpdateLeads } from "../hooks/use-leads";

export function NavOptionsTracking() {
  const { trackingId } = useParams<{ trackingId: string }>();

  const { trackings } = useQueryTrackings();
  const { selectedLeads, clearSelection } = useLeadStore();
  const [selectedTrackingId, setSelectedTrackingId] = useState(trackingId);
  const { status } = useQueryStatus({ trackingId: selectedTrackingId });
  const mutationUpdate = useMutationUpdateLeads();

  if (selectedLeads.length === 0) return null;

  const handleMoveToStatus = (statusId: string) => {
    if (selectedLeads.every((lead) => lead.statusId === statusId)) return;
    const leadsIds = selectedLeads.map((lead) => lead.id);
    mutationUpdate.mutate(
      {
        leadsIds,
        trackingId: selectedTrackingId,
        statusId,
      },
      {
        onSuccess: () => {
          clearSelection();
        },
      },
    );
  };

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between w-full max-w-[80%] bg-background border rounded-md px-4 py-2 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center gap-x-2">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={clearSelection}
          className="rounded-full"
        >
          <X className="size-4" />
        </Button>
        <Badge variant="secondary" className="rounded-full">
          {selectedLeads.length} selecionados
        </Badge>
      </div>
      <div className="flex items-center gap-x-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="sm" className="rounded-full">
              <RedoDotIcon className="size-4 mr-2" />
              Mover para
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[200px]">
            <div className="space-y-1">
              <div>Trackings</div>
              <ScrollArea className="h-[150px] pr-2 ">
                {trackings.map((tracking) => (
                  <div
                    className="flex items-center gap-x-2 cursor-pointer hover:bg-secondary rounded-md px-2 py-1 text-sm transition-colors"
                    key={tracking.id}
                    onClick={() => setSelectedTrackingId(tracking.id)}
                  >
                    {tracking.id === selectedTrackingId ? (
                      <CircleCheckIcon className="size-4" />
                    ) : (
                      <CircleIcon className="size-4 " />
                    )}
                    <span>{tracking.name}</span>
                  </div>
                ))}
              </ScrollArea>
            </div>
            <Separator className="my-2" />
            <div className="space-y-1">
              <div>Status</div>
              <ScrollArea className="h-[150px] pr-2">
                {status?.map((s) => {
                  const statusSelected = selectedLeads.every(
                    (lead) => lead.statusId === s.id,
                  );
                  return (
                    <div
                      className="flex items-center gap-x-2 cursor-pointer hover:bg-secondary rounded-md px-2 py-1 text-sm transition-colors"
                      key={s.id}
                      onClick={() => handleMoveToStatus(s.id)}
                    >
                      {statusSelected ? (
                        <CircleCheckIcon className="size-4" />
                      ) : (
                        <CircleIcon className="size-4 " />
                      )}
                      {s.name}
                    </div>
                  );
                })}
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </nav>
  );
}
