"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryTrackings } from "@/features/trackings/hooks/use-trackings";
import { useStatus } from "@/features/status/hooks/use-status";

interface SelectTrackingPopoverProps {
  currentTrackingId: string;
  currentStatusId: string;
  onSubmit: (trackingId: string, statusId: string) => void;
  isLoading?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function SelectTrackingPopover({
  currentTrackingId,
  currentStatusId,
  onSubmit,
  isLoading,
  open,
  onOpenChange,
  children
}: SelectTrackingPopoverProps) {
  const { trackings, isLoading: isLoadingTrackings } = useQueryTrackings();
  const [selectedTrackingId, setSelectedTrackingId] = useState<string>(currentTrackingId);
  const [selectedStatusId, setSelectedStatusId] = useState<string>(currentStatusId);

  const handleTrackingChange = (value: string) => {
    setSelectedTrackingId(value);
    setSelectedStatusId(""); 
  };

  const handleSubmit = () => {
    if (selectedTrackingId && selectedStatusId) {
      onSubmit(selectedTrackingId, selectedStatusId);
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 flex flex-col gap-4 p-4" align="end">
        <div>
          <h4 className="font-semibold text-sm leading-none mb-1">Mover Lead</h4>
          <p className="text-sm text-muted-foreground">
            Selecione o novo fluxo e o status para este lead.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold">Fluxo / Tracking:</label>
          <Select 
            value={selectedTrackingId} 
            onValueChange={handleTrackingChange} 
            disabled={isLoading || isLoadingTrackings}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione o fluxo" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {trackings?.map((tracking) => (
                  <SelectItem key={tracking.id} value={tracking.id}>
                    {tracking.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold">Status:</label>
          <StatusSelect 
            trackingId={selectedTrackingId} 
            value={selectedStatusId} 
            onChange={setSelectedStatusId} 
            disabled={isLoading || !selectedTrackingId} 
          />
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button 
            size="sm" 
            disabled={!selectedTrackingId || !selectedStatusId || isLoading}
            onClick={handleSubmit}
          >
            Salvar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function StatusSelect({ trackingId, value, onChange, disabled }: { trackingId: string, value: string, onChange: (val: string) => void, disabled: boolean }) {
  const { status: statuses, isLoadingStatus } = useStatus(trackingId);

  return (
    <Select 
      value={value} 
      onValueChange={onChange} 
      disabled={disabled || isLoadingStatus || !trackingId}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Selecione o status" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {statuses?.map((status) => (
            <SelectItem key={status.id} value={status.id}>
              {status.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
