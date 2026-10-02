"use client";

import Link from "next/link";
import { CalendarClock, ChevronRight, Send, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { useBroadcasts } from "../hooks/use-broadcasts";
import {
  BROADCAST_STATUS_LABEL,
  BROADCAST_STATUS_STYLE,
} from "../lib/broadcast-status";
import { CreateBroadcastDialog } from "./create-broadcast-dialog";
import { OfficialNumberOverview } from "./self-service/official-number-overview";
import { CampanhasHero } from "./campanhas-hero";
import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useActiveTrackingId } from "../hooks/use-active-tracking-id";
import { CAMPAIGNS_LIST_PARAM } from "./campanhas-shell";
import { useActiveNumberStore } from "../stores/use-active-number-store";

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        BROADCAST_STATUS_STYLE[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {BROADCAST_STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function BroadcastsList() {
  const activeTrackingId = useActiveTrackingId();
  const selectTrackingId = useActiveNumberStore((state) => state.selectTrackingId);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <CampanhasHero />

      <Suspense fallback={null}>
        <CampanhasSections activeTrackingId={activeTrackingId} onActiveTrackingChange={selectTrackingId} />
      </Suspense>
    </div>
  );
}

/** "Como funciona?" (padrão) ou a lista de campanhas (?lista=1), conforme o item do menu. */
function CampanhasSections({
  activeTrackingId,
  onActiveTrackingChange,
}: {
  activeTrackingId: string | null;
  onActiveTrackingChange: (trackingId: string) => void;
}) {
  const searchParams = useSearchParams();
  const isListOpen = searchParams.get(CAMPAIGNS_LIST_PARAM) === "1";
  return (
    <>
      <OfficialNumberOverview
        activeTrackingId={activeTrackingId}
        onActiveTrackingChange={onActiveTrackingChange}
        isIntroVisible={!isListOpen}
      />
      {isListOpen && <CampaignsListSection />}
    </>
  );
}

function CampaignsListSection() {
  const { data: broadcasts, isLoading } = useBroadcasts();
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div ref={sectionRef} className="scroll-mt-20">
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : !broadcasts || broadcasts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] border border-dashed px-4 py-10 text-center sm:py-20">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Send className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Nenhuma campanha ainda</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Crie sua primeira campanha para montar uma audiência e disparar.
            </p>
          </div>
          <CreateBroadcastDialog />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {broadcasts.map((broadcast) => {
            const total = broadcast.totalRecipients;
            const sent = broadcast.sentCount;
            const progress = total > 0 ? Math.round((sent / total) * 100) : 0;
            return (
              <Link
                key={broadcast.id}
                href={`/campanhas/${broadcast.id}`}
                className="group flex items-center gap-4 rounded-[20px] border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-accent/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{broadcast.name}</p>
                    <StatusPill status={broadcast.status} />
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                    {broadcast.status === "SCHEDULED" && broadcast.scheduledAt ? (
                      <>
                        <CalendarClock className="size-3.5 shrink-0" />
                        <span>
                          {new Date(broadcast.scheduledAt).toLocaleString(
                            "pt-BR",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                        <span aria-hidden>·</span>
                        <span className="truncate">{broadcast.tracking.name}</span>
                      </>
                    ) : (
                      broadcast.tracking.name
                    )}
                  </p>
                </div>

                <div className="hidden w-40 shrink-0 sm:block">
                  {total > 0 && (
                    <>
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{progress}% enviado</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-success transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="size-4" />
                  <span className="tabular-nums">{total}</span>
                </div>

                <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
