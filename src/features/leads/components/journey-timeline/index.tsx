"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import relativeTime from "dayjs/plugin/relativeTime";
import { FlagIcon, Megaphone, TimerIcon, ZapIcon } from "lucide-react";
import { orpc } from "@/lib/orpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { TriggerIcon } from "@/features/leads/components/lead-triggers/trigger-icon";
import { QuickWorkflowDialog } from "@/features/workflows/components/quick-builder/quick-workflow-dialog";
import {
  IDLE_ALERT_DAYS,
  formatGap,
  gapSeverity,
  idleSinceLastTeamTouch,
  isTeamTouch,
  positionOnSpan,
  type GapSeverity,
} from "@/features/leads/lib/journey/journey-gaps";
import { JourneyEventIcon } from "./event-icon";
import { EventMetadataPreview, deriveKindLabel } from "./event-details";

// Jornada do lead como linha do tempo: de onde veio até hoje, com o tempo
// parado entre cada passo — vermelho quando a equipe ficou 15+ dias sem agir —
// e atalhos para acionar o lead ali mesmo.

dayjs.extend(relativeTime);
dayjs.locale("pt-br");

export type JourneyActionScreen = "leadTriggers" | "campaigns";

interface JourneyTimelineProps {
  leadId: string;
  /** Com tracking, a linha oferece "Criar gatilho". */
  trackingId?: string;
  /** Com callback, a linha oferece abrir Gatilho do lead e Campanhas. */
  onOpenScreen?: (screen: JourneyActionScreen) => void;
}

const SEVERITY_STYLES: Record<GapSeverity, { line: string; chip: string }> = {
  ok: { line: "bg-success/40", chip: "bg-success/10 text-success" },
  warn: { line: "bg-warning/60", chip: "bg-warning/10 text-warning" },
  idle: { line: "bg-destructive", chip: "bg-destructive/15 text-destructive" },
};

const STAGGER_MS = 60;

export function JourneyTimeline({ leadId, trackingId, onOpenScreen }: JourneyTimelineProps) {
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const { data, isLoading } = useQuery(orpc.leads.getJourney.queryOptions({ input: { leadId, limit: 200 } }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }
  if (!data) return null;

  const lead = data.lead;
  const now = new Date();
  const leadCreatedAt = new Date(lead.createdAt);
  const events = [...data.events]
    .map((event) => ({ ...event, occurredAt: new Date(event.occurredAt) }))
    .sort((first, second) => first.occurredAt.getTime() - second.occurredAt.getTime());
  const idleMs = idleSinceLastTeamTouch(events, leadCreatedAt, now);
  const idleNow = gapSeverity(idleMs);
  const hasActions = Boolean(onOpenScreen || trackingId);

  const actions = hasActions ? (
    <JourneyActions
      onOpenScreen={onOpenScreen}
      onCreateTrigger={trackingId ? () => setIsBuilderOpen(true) : undefined}
    />
  ) : null;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-2">
      {trackingId && (
        <QuickWorkflowDialog
          isOpen={isBuilderOpen}
          onOpenChange={setIsBuilderOpen}
          trackingId={trackingId}
          leadId={leadId}
          leadName={lead.name}
        />
      )}

      <OriginCard lead={lead} />

      <TimelapseRuler events={events} start={leadCreatedAt} now={now} idleSeverity={idleNow} />

      <ol className="relative flex flex-col">
        {events.map((event, index) => {
          const previousAt = index === 0 ? leadCreatedAt : events[index - 1].occurredAt;
          const gapMs = event.occurredAt.getTime() - previousAt.getTime();
          return (
            <li key={event.id} className="flex flex-col">
              <GapConnector gapMs={gapMs} delayMs={index * STAGGER_MS} actions={actions} />
              <div
                className="flex items-start gap-3 fill-mode-both animate-in fade-in slide-in-from-left-2 duration-500"
                style={{ animationDelay: `${index * STAGGER_MS}ms` }}
              >
                <JourneyEventIcon kind={event.kind} />
                <div className="min-w-0 flex-1 rounded-xl border bg-muted/20 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{deriveKindLabel(event.kind, event.metadata)}</span>
                    <span className="text-[11px] text-muted-foreground" title={dayjs(event.occurredAt).format("DD/MM/YYYY HH:mm")}>
                      {dayjs(event.occurredAt).format("DD/MM HH:mm")} · {dayjs(event.occurredAt).fromNow()}
                    </span>
                  </div>
                  {event.actor && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <Avatar className="size-4">
                        {event.actor.image ? <AvatarImage src={event.actor.image} alt={event.actor.name} /> : null}
                        <AvatarFallback className="text-[9px]">{event.actor.name?.[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-[11px] text-muted-foreground">{event.actor.name}</span>
                    </div>
                  )}
                  <EventMetadataPreview kind={event.kind} metadata={event.metadata} />
                </div>
              </div>
            </li>
          );
        })}

        <li className="flex flex-col">
          <GapConnector gapMs={idleMs} delayMs={events.length * STAGGER_MS} label="sem ação da equipe" actions={actions} />
          <div
            className="flex items-center gap-3 fill-mode-both animate-in fade-in duration-500"
            style={{ animationDelay: `${events.length * STAGGER_MS}ms` }}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full",
                idleNow === "idle" ? "animate-pulse bg-destructive text-white" : "bg-foreground text-background",
              )}
            >
              <FlagIcon className="size-4" />
            </span>
            <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Hoje</p>
                <p className={cn("text-xs", idleNow === "idle" ? "text-destructive" : "text-muted-foreground")}>
                  {idleNow === "idle"
                    ? `Parado há ${formatGap(idleMs)} — mais de ${IDLE_ALERT_DAYS} dias sem ninguém acionar.`
                    : `Última ação da equipe há ${formatGap(idleMs)}.`}
                </p>
              </div>
              {idleNow !== "idle" && actions}
            </div>
          </div>
        </li>
      </ol>
    </div>
  );
}

type JourneyLead = {
  name: string;
  createdAt: Date | string;
  source: string;
  utmSource: string | null;
  utmCampaign: string | null;
  metaCampaignId: string | null;
  metaAdId: string | null;
  metaHeadline: string | null;
};

function OriginCard({ lead }: { lead: JourneyLead }) {
  const details = [
    lead.metaCampaignId && `Campanha Meta ${lead.metaCampaignId}`,
    lead.metaAdId && `Anúncio ${lead.metaAdId}`,
    lead.utmSource && `utm_source ${lead.utmSource}`,
    lead.utmCampaign && `utm_campaign ${lead.utmCampaign}`,
  ].filter(Boolean);
  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-gradient-to-br from-success/10 to-transparent p-3 animate-in fade-in duration-500">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
        <Megaphone className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          Entrou em {dayjs(lead.createdAt).format("DD/MM/YYYY")} · origem {lead.source.toLowerCase().replaceAll("_", " ")}
        </p>
        <p className="text-xs text-muted-foreground">
          Há {dayjs(lead.createdAt).fromNow(true)} na jornada{details.length ? ` · ${details.join(" · ")}` : ""}
        </p>
        {lead.metaHeadline && <p className="mt-0.5 text-xs italic text-muted-foreground">&quot;{lead.metaHeadline}&quot;</p>}
      </div>
    </div>
  );
}

interface RulerEvent {
  id: string;
  kind: string;
  occurredAt: Date;
}

/** Linha do tempo em miniatura: da entrada até hoje, com os trechos parados pintados. */
function TimelapseRuler({ events, start, now, idleSeverity }: { events: RulerEvent[]; start: Date; now: Date; idleSeverity: GapSeverity }) {
  const teamTouches = events.filter((event) => isTeamTouch(event.kind));
  const checkpoints = [start, ...teamTouches.map((event) => event.occurredAt), now];
  const idleSpans = checkpoints.slice(1).flatMap((end, index) => {
    const spanStart = checkpoints[index];
    const severity = gapSeverity(end.getTime() - spanStart.getTime());
    if (severity === "ok") return [];
    return [
      {
        key: `${spanStart.getTime()}-${end.getTime()}`,
        left: positionOnSpan(spanStart, start, now),
        width: positionOnSpan(end, start, now) - positionOnSpan(spanStart, start, now),
        severity,
      },
    ];
  });

  return (
    <div className="rounded-2xl border bg-muted/20 p-3">
      <div className="mb-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <TimerIcon className="size-3.5" />
          {events.length} passo{events.length === 1 ? "" : "s"} em {formatGap(now.getTime() - start.getTime())}
        </span>
        <span className="flex items-center gap-3">
          <Legend className="bg-warning/70" label={`+3 dias`} />
          <Legend className="bg-destructive" label={`+${IDLE_ALERT_DAYS} dias parado`} />
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-muted">
        <div className="animate-journey-grow absolute inset-y-0 left-0 w-full origin-left rounded-full bg-success/30" />
        {idleSpans.map((span) => (
          <div
            key={span.key}
            className={cn(
              "absolute inset-y-0 rounded-full animate-in fade-in duration-700",
              span.severity === "idle" ? "bg-destructive animate-pulse" : "bg-warning/70",
            )}
            style={{ left: `${span.left}%`, width: `${Math.max(span.width, 1)}%` }}
          />
        ))}
        {events.map((event, index) => (
          <span
            key={event.id}
            title={dayjs(event.occurredAt).format("DD/MM/YYYY HH:mm")}
            className={cn(
              "absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background fill-mode-both animate-in zoom-in duration-300",
              isTeamTouch(event.kind) ? "bg-success" : "bg-info",
            )}
            style={{ left: `${positionOnSpan(event.occurredAt, start, now)}%`, animationDelay: `${300 + index * 40}ms` }}
          />
        ))}
        <span
          className={cn(
            "absolute right-0 top-1/2 size-3 -translate-y-1/2 translate-x-1/2 rounded-full border-2 border-background",
            idleSeverity === "idle" ? "animate-ping bg-destructive" : "bg-foreground",
          )}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{dayjs(start).format("DD/MM/YY")}</span>
        <span className="flex items-center gap-2">
          <Legend className="bg-success" label="equipe" />
          <Legend className="bg-info" label="lead" />
        </span>
        <span>hoje</span>
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn("size-2 rounded-full", className)} />
      {label}
    </span>
  );
}

/** Trecho entre dois passos: a cor diz quanto tempo passou; vermelho oferece ação. */
function GapConnector({
  gapMs,
  delayMs,
  label,
  actions,
}: {
  gapMs: number;
  delayMs: number;
  label?: string;
  actions: React.ReactNode;
}) {
  const severity = gapSeverity(gapMs);
  const styles = SEVERITY_STYLES[severity];
  return (
    <div className="flex min-h-7 gap-3 fill-mode-both animate-in fade-in duration-500" style={{ animationDelay: `${delayMs}ms` }}>
      <div className="flex w-8 shrink-0 justify-center">
        <div className={cn("w-0.5 rounded-full", styles.line, severity === "idle" && "w-1 animate-pulse")} />
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-2 py-1.5">
        {severity !== "ok" && (
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", styles.chip)}>
            {formatGap(gapMs)} {label ?? (severity === "idle" ? "sem acionamento" : "depois")}
          </span>
        )}
        {severity === "idle" && actions}
      </div>
    </div>
  );
}

function JourneyActions({
  onOpenScreen,
  onCreateTrigger,
}: {
  onOpenScreen?: (screen: JourneyActionScreen) => void;
  onCreateTrigger?: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {onOpenScreen && (
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]" onClick={() => onOpenScreen("leadTriggers")}>
          <TriggerIcon className="size-3.5" />
          Gatilho do lead
        </Button>
      )}
      {onCreateTrigger && (
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]" onClick={onCreateTrigger}>
          <ZapIcon className="size-3.5" />
          Criar gatilho
        </Button>
      )}
      {onOpenScreen && (
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]" onClick={() => onOpenScreen("campaigns")}>
          <Megaphone className="size-3.5" />
          Disparo em Massa
        </Button>
      )}
    </div>
  );
}
