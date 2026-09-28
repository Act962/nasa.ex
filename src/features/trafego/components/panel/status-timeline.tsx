import { CheckCircle2, CircleDashed, CircleDot } from "lucide-react";
import type { TrafegoOrderStatus } from "@/generated/prisma/enums";
import {
  ORDER_STATUS_LABEL,
  ORDER_TIMELINE_STEPS,
} from "@/features/trafego/lib/order-status";
import { cn } from "@/lib/utils";

interface TimelineEvent {
  id: string;
  toStatus: TrafegoOrderStatus;
  title: string;
  detail: string | null;
  createdAt: Date | string;
}

/**
 * Etapas do fluxo + histórico real. As etapas dão a noção de progresso; os
 * eventos contam o que de fato aconteceu, incluindo as voltas (ajustes),
 * que uma barra de progresso sozinha esconderia.
 */
export function StatusTimeline({
  status,
  events,
}: {
  status: TrafegoOrderStatus;
  events: TimelineEvent[];
}) {
  const currentIndex = ORDER_TIMELINE_STEPS.indexOf(status);
  const isExceptionStatus = currentIndex === -1;

  return (
    <div className="space-y-6">
      {!isExceptionStatus && (
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ORDER_TIMELINE_STEPS.map((step, index) => {
            const isDone = index < currentIndex;
            const isCurrent = index === currentIndex;
            return (
              <li
                key={step}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                  isCurrent && "border-primary/40 bg-primary/5 font-medium",
                  isDone && "text-muted-foreground",
                  !isDone && !isCurrent && "text-muted-foreground/60",
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                ) : isCurrent ? (
                  <CircleDot className="size-4 shrink-0 text-primary" />
                ) : (
                  <CircleDashed className="size-4 shrink-0" />
                )}
                {ORDER_STATUS_LABEL[step]}
              </li>
            );
          })}
        </ol>
      )}

      <div>
        <h3 className="text-sm font-semibold">Histórico</h3>
        <ol className="mt-3 space-y-4 border-l pl-4">
          {events.map((event) => (
            <li key={event.id} className="relative">
              <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-primary" />
              <p className="text-sm font-medium">{event.title}</p>
              {event.detail && (
                <p className="mt-0.5 text-sm text-muted-foreground">{event.detail}</p>
              )}
              <time className="mt-0.5 block text-xs text-muted-foreground">
                {new Date(event.createdAt).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
