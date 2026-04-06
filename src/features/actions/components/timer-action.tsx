"use client";

import { useMemo, useCallback } from "react";
import { Play, Pause, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useStartTimer, useStopTimer } from "../hooks/use-timer";
import { ActionTimer } from "../types";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useTimerStore } from "../lib/timer-store";

interface Props {
  actionId: string;
  timers: ActionTimer[];
  participants: { user: { id: string } }[];
  responsibles: { user: { id: string } }[];
}

export function TimerAction({ actionId, timers = [], participants = [], responsibles = [] }: Props) {
  const { data: session } = authClient.useSession();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();

  // Estado global do Zustand
  const activeActionId = useTimerStore((state) => state.activeActionId);
  const currentSeconds = useTimerStore((state) => state.currentSeconds);

  // Se esta ação específica está rodando no estado global (pelo usuário logado)
  const isRunning = activeActionId === actionId;

  // Verifica se há um timer rodando de outro usuário nesta mesma ação
  const remoteActiveTimer = useMemo(() => timers.find((t) => t.stoppedAt === null), [timers]);
  const isOtherRunning = !!remoteActiveTimer && remoteActiveTimer.userId !== session?.user?.id;

  const canControl = useMemo(() => {
    if (!session?.user?.id) return false;
    const isParticipant = participants.some((p) => p.user.id === session.user.id);
    const isResponsible = responsibles.some((r) => r.user.id === session.user.id);
    return isParticipant || isResponsible;
  }, [session, participants, responsibles]);

  // Tempo acumulado total das sessões passadas (fatias fechadas)
  const accumulatedSeconds = useMemo(() => {
    return timers.reduce((acc, t) => acc + (t.duration || 0), 0);
  }, [timers]);

  // Se estiver rodando, usamos o contador global do Zustand. Se não, o acumulado estático.
  const displaySeconds = isRunning ? currentSeconds : accumulatedSeconds;

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return [h, m, s].map((v) => v.toString().padStart(2, "0")).join(":");
  };

  const handleToggle = useCallback(() => {
    if (isRunning) {
      stopTimer.mutate({ actionId });
    } else {
      startTimer.mutate({ actionId });
    }
  }, [isRunning, actionId, stopTimer, startTimer]);

  const showTooltip = isOtherRunning && remoteActiveTimer?.user;

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/50 border border-border shadow-sm">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "flex items-center gap-1.5 font-mono text-[13px] font-semibold tabular-nums tracking-tight transition-colors",
            isRunning ? "text-primary dark:text-blue-400" : "text-muted-foreground"
          )}>
            <Clock className={cn("size-3.5", isRunning && "animate-pulse")} />
            {formatTime(displaySeconds)}
          </div>
        </TooltipTrigger>
        {showTooltip && (
          <TooltipContent side="bottom" align="center" className="text-[10px]">
             Cronometrando por: {remoteActiveTimer.user?.name}
          </TooltipContent>
        )}
      </Tooltip>

      {canControl && (
        <Button
          variant="ghost"
          size="icon"
          className="size-6 rounded-full hover:bg-primary/10 hover:text-primary transition-all ml-0.5"
          onClick={handleToggle}
          disabled={startTimer.isPending || stopTimer.isPending || isOtherRunning}
          title={isRunning ? "Pausar" : "Iniciar"}
        >
          {isRunning ? 
            <Pause className="size-3 fill-current" /> : 
            <Play className="size-3 fill-current ml-0.5" />
          }
        </Button>
      )}
    </div>
  );
}

