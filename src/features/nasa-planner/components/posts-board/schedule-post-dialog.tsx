"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSchedulePlannerPost } from "../../hooks/use-nasa-planner";

interface SchedulePostDialogProps {
  postId: string | null;
  onClose: () => void;
}

export function SchedulePostDialog({ postId, onClose }: SchedulePostDialogProps) {
  const schedulePost = useSchedulePlannerPost();
  const [scheduleDate, setScheduleDate] = useState("");

  const handleSchedule = async () => {
    if (!postId || !scheduleDate) return;
    await schedulePost.mutateAsync({ postId, scheduledAt: new Date(scheduleDate).toISOString() });
    onClose();
    setScheduleDate("");
  };

  return (
    <Dialog open={!!postId} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-sm max-h-[95vh] sm:max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Agendar Post</DialogTitle></DialogHeader>
        <div className="space-y-1.5">
          <Label>Data e Hora</Label>
          <Input type="datetime-local" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSchedule} disabled={!scheduleDate || schedulePost.isPending}>
            {schedulePost.isPending ? "Agendando..." : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
