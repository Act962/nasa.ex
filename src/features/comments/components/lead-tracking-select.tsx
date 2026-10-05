"use client";

import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCommentsLeadTracking, useSetCommentsLeadTracking } from "../hooks/use-comments-channel";

/** Em qual tracking entram os leads desta conta do Instagram (spec 0062, RF-1; por conta na 0069, RF-16). */
export function LeadTrackingSelect({ channelId, isDisabled = false }: { channelId: string; isDisabled?: boolean }) {
  const { data } = useCommentsLeadTracking(channelId);
  const setLeadTracking = useSetCommentsLeadTracking();
  if (!data || data.trackings.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Leads desta conta entram no tracking</Label>
      <Select
        value={data.trackingId ?? undefined}
        disabled={setLeadTracking.isPending || isDisabled}
        onValueChange={(trackingId) =>
          setLeadTracking.mutate(
            { channelId, trackingId },
            { onSuccess: () => toast.success("Tracking dos leads desta conta atualizado."), onError: (error) => toast.error(error.message) },
          )
        }
      >
        <SelectTrigger className="w-full sm:w-80">
          <SelectValue placeholder="Escolha o tracking" />
        </SelectTrigger>
        <SelectContent>
          {data.trackings.map((tracking) => (
            <SelectItem key={tracking.id} value={tracking.id}>
              {tracking.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">Todo comentário e DM viram lead com o @ e a tag &ldquo;Instagram&rdquo; no tracking-chat.</p>
    </div>
  );
}
