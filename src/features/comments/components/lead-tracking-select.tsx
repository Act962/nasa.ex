"use client";

import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCommentsLeadTracking, useSetCommentsLeadTracking } from "../hooks/use-comments-channel";

/** Em qual tracking entram os leads do Instagram (spec 0062, RF-1). */
export function LeadTrackingSelect() {
  const { data } = useCommentsLeadTracking();
  const setLeadTracking = useSetCommentsLeadTracking();
  if (!data || data.trackings.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Leads do Instagram entram no tracking</Label>
      <Select
        value={data.trackingId ?? undefined}
        disabled={setLeadTracking.isPending}
        onValueChange={(trackingId) =>
          setLeadTracking.mutate(
            { trackingId },
            { onSuccess: () => toast.success("Tracking dos leads do Instagram atualizado."), onError: (error) => toast.error(error.message) },
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
