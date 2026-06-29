"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent } from "@/components/ui/card";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import relativeTime from "dayjs/plugin/relativeTime";
import { JourneyEventIcon, kindLabel } from "./event-icon";
import { Megaphone, ExternalLink } from "lucide-react";

dayjs.extend(relativeTime);
dayjs.locale("pt-br");

interface JourneyTimelineProps {
  leadId: string;
}

export function JourneyTimeline({ leadId }: JourneyTimelineProps) {
  const { data, isLoading } = useQuery(
    orpc.leads.getJourney.queryOptions({
      input: { leadId, limit: 200 },
    }),
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!data || data.events.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Sem eventos registrados na jornada deste lead ainda.
        </CardContent>
      </Card>
    );
  }

  const lead = data.lead;
  const hasOriginInfo = !!(
    lead.metaCampaignId ||
    lead.metaAdId ||
    lead.utmCampaign ||
    lead.utmSource
  );

  return (
    <div className="overflow-y-auto h-full pr-2">
      {hasOriginInfo && (
        <Card className="mb-4 border-emerald-200 bg-emerald-50/50">
          <CardContent className="py-3 px-4 flex items-start gap-3">
            <div className="size-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <Megaphone className="size-4 text-emerald-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">Origem do lead</div>
              <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                {lead.metaCampaignId && (
                  <div>
                    <span className="font-medium">Campanha Meta: </span>
                    {lead.metaCampaignId}
                  </div>
                )}
                {lead.metaAdId && (
                  <div>
                    <span className="font-medium">Anúncio: </span>
                    {lead.metaAdId}
                  </div>
                )}
                {lead.metaHeadline && (
                  <div className="italic">"{lead.metaHeadline}"</div>
                )}
                {lead.utmSource && (
                  <div>
                    <span className="font-medium">UTM source: </span>
                    {lead.utmSource}
                  </div>
                )}
                {lead.utmCampaign && (
                  <div>
                    <span className="font-medium">UTM campaign: </span>
                    {lead.utmCampaign}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative pl-8">
        {/* Linha vertical */}
        <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" />

        {data.events.map((evt, idx) => (
          <div key={evt.id} className="relative pb-5 last:pb-0">
            {/* Bolinha do ícone (sobrepõe a linha) */}
            <div className="absolute -left-8 top-0">
              <JourneyEventIcon kind={evt.kind} />
            </div>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">
                    {deriveKindLabel(evt.kind, evt.metadata)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {dayjs(evt.occurredAt).format("DD/MM/YYYY HH:mm")} (
                    {dayjs(evt.occurredAt).fromNow()})
                  </span>
                </div>
                {evt.actor && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Avatar className="size-5">
                      {evt.actor.image ? (
                        <AvatarImage src={evt.actor.image} alt={evt.actor.name} />
                      ) : null}
                      <AvatarFallback className="text-[10px]">
                        {evt.actor.name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">
                      {evt.actor.name}
                    </span>
                  </div>
                )}
                {/* Metadata renderizada por kind */}
                <EventMetadataPreview kind={evt.kind} metadata={evt.metadata} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventMetadataPreview({
  kind,
  metadata,
}: {
  kind: string;
  metadata: Record<string, unknown>;
}) {
  if (!metadata || Object.keys(metadata).length === 0) return null;

  if (kind === "message_in" || kind === "message_out") {
    const body = metadata.body as string | undefined;
    if (!body) return null;
    return (
      <div className="text-sm bg-muted/50 rounded-md px-3 py-1.5 mt-1.5 max-w-xl line-clamp-2">
        {body}
      </div>
    );
  }

  if (kind === "ctwa_referral") {
    return (
      <div className="text-xs mt-1 space-y-0.5">
        {Boolean(metadata.headline) && (
          <div className="italic">"{String(metadata.headline)}"</div>
        )}
        {Boolean(metadata.metaCampaignId) && (
          <div className="text-muted-foreground">
            Campanha: {String(metadata.metaCampaignId)}
          </div>
        )}
        {Boolean(metadata.sourceUrl) && (
          <a
            href={String(metadata.sourceUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
          >
            Ver criativo <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    );
  }

  if (kind === "status_changed") {
    const fromName = String(metadata.from ?? "—");
    const toName = String(metadata.to ?? "—");
    const fromColor =
      typeof metadata.fromColor === "string" ? metadata.fromColor : null;
    const toColor =
      typeof metadata.toColor === "string" ? metadata.toColor : null;
    return (
      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
        de{" "}
        <Badge
          variant="outline"
          className="text-[10px] gap-1"
          style={
            fromColor
              ? {
                  borderColor: fromColor,
                  color: fromColor,
                  background: `${fromColor}15`,
                }
              : undefined
          }
        >
          {fromColor && (
            <span
              className="size-1.5 rounded-full"
              style={{ background: fromColor }}
            />
          )}
          {fromName}
        </Badge>{" "}
        para{" "}
        <Badge
          variant="outline"
          className="text-[10px] gap-1"
          style={
            toColor
              ? {
                  borderColor: toColor,
                  color: toColor,
                  background: `${toColor}15`,
                }
              : undefined
          }
        >
          {toColor && (
            <span
              className="size-1.5 rounded-full"
              style={{ background: toColor }}
            />
          )}
          {toName}
        </Badge>
      </div>
    );
  }

  if (kind === "tracking_changed") {
    return (
      <div className="text-xs text-muted-foreground mt-1">
        de <Badge variant="outline" className="text-[10px]">{String(metadata.from ?? "—")}</Badge>{" "}
        para <Badge variant="outline" className="text-[10px]">{String(metadata.to ?? "—")}</Badge>
      </div>
    );
  }

  if (kind === "lead_assigned") {
    if (!metadata.responsibleName) return null;
    return (
      <div className="text-xs text-muted-foreground mt-1">
        Responsável: <strong>{String(metadata.responsibleName)}</strong>
      </div>
    );
  }

  if (kind === "tag_added" || kind === "tag_removed") {
    if (!metadata.tagName) return null;
    const color =
      typeof metadata.tagColor === "string" ? metadata.tagColor : "#888";
    return (
      <div className="mt-1">
        <Badge
          variant="outline"
          className="text-[10px] gap-1"
          style={{
            borderColor: color,
            color: color,
            background: `${color}15`,
          }}
        >
          <span className="size-1.5 rounded-full" style={{ background: color }} />
          {String(metadata.tagName)}
        </Badge>
      </div>
    );
  }

  if (kind === "form_submit") {
    if (!metadata.formName) return null;
    const edited = metadata.edited === true;
    const returning = metadata.returning === true;
    const started = metadata.started === true;
    const clientSigned = metadata.clientSigned === true;
    const label =
      typeof metadata.label === "string" && metadata.label.trim().length > 0
        ? metadata.label.trim()
        : null;
    return (
      <div className="text-xs text-muted-foreground mt-1">
        {started
          ? "Iniciou o preenchimento de: "
          : clientSigned
            ? "Cliente assinou: "
            : edited
              ? "Atualizou: "
              : returning
                ? "Reenviou: "
                : "Preencheu: "}
        <strong>{String(metadata.formName)}</strong>
        {label && (
          <span className="text-muted-foreground/80"> · {label}</span>
        )}
      </div>
    );
  }

  if (kind === "file_uploaded") {
    const fileName =
      typeof metadata.fileName === "string" ? metadata.fileName : null;
    if (!fileName) return null;
    return (
      <div className="text-xs text-muted-foreground mt-1 truncate">
        Arquivo: <strong>{fileName}</strong>
      </div>
    );
  }

  if (kind === "note") {
    const text = typeof metadata.notes === "string" ? metadata.notes : null;
    if (!text) return null;
    return (
      <div className="text-sm bg-muted/50 rounded-md px-3 py-1.5 mt-1.5 max-w-xl line-clamp-3">
        {text}
      </div>
    );
  }

  if (kind === "utm_landing") {
    const parts: string[] = [];
    if (metadata.utmSource) parts.push(`source: ${metadata.utmSource}`);
    if (metadata.utmCampaign) parts.push(`campaign: ${metadata.utmCampaign}`);
    if (metadata.utmMedium) parts.push(`medium: ${metadata.utmMedium}`);
    if (parts.length === 0) return null;
    return (
      <div className="text-xs text-muted-foreground mt-1">
        {parts.join(" · ")}
      </div>
    );
  }

  return null;
}

// FORM_STARTED compartilha kind="form_submit" com FORM_SUBMITTED, mas é
// diferenciado por metadata.started — sobrescreve o título da timeline.
function deriveKindLabel(
  kind: string,
  metadata: Record<string, unknown> | null | undefined,
): string {
  if (kind === "form_submit") {
    if (metadata?.started === true) return "Formulário iniciado";
    if (metadata?.clientSigned === true) return "Cliente assinou o formulário";
    if (metadata?.edited === true) return "Formulário atualizado";
  }
  return kindLabel(kind);
}
