"use client";

import { useEffect, useState } from "react";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useRevokeStarFriendsDraw } from "../hooks/use-star-friends-campaign";
import { revocableUntil } from "../utils/live-draw";

export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export type RevocableDraw = { id: string; position: number; displayName: string; code: string; drawnAt: Date | string };

export function CampaignDrawRevokeButton({ draw, variant = "panel" }: { draw: RevocableDraw; variant?: "panel" | "stage" }) {
  const now = useNow();
  const revoke = useRevokeStarFriendsDraw();
  const [reason, setReason] = useState("");
  const remainingMs = revocableUntil(draw.drawnAt).getTime() - now.getTime();
  if (remainingMs <= 0) return null;

  return (
    <AlertDialog onOpenChange={(isOpen) => !isOpen && setReason("")}>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={revoke.isPending}
          className={cn(
            "h-8 gap-1.5 rounded-full px-3 text-xs tabular-nums",
            variant === "stage" && "border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white",
          )}
        >
          {revoke.isPending ? <OrbitaSpinner className="size-3.5" /> : <Undo2 className="size-3.5" />}
          Revogar · {formatCountdown(remainingMs)}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revogar o {draw.position}º prêmio?</AlertDialogTitle>
          <AlertDialogDescription>
            {draw.displayName} (número {draw.code}) deixa de ser ganhador e volta a concorrer. O {draw.position}º prêmio fica livre para ser
            sorteado de novo. A revogação fica registrada no histórico.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input placeholder="Motivo (opcional). Ex.: sorteado sem querer" value={reason} maxLength={200} onChange={(event) => setReason(event.target.value)} />
        <AlertDialogFooter>
          <AlertDialogCancel>Manter</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() =>
              revoke.mutate(
                { drawId: draw.id, reason: reason.trim() || null },
                {
                  onSuccess: () => toast.success(`${draw.position}º prêmio revogado. Ele volta a ser sorteado.`),
                  onError: (error) => toast.error(error.message),
                },
              )
            }
          >
            Revogar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
