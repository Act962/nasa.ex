"use client";

import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { kindLabel } from "./event-icon";

// Rótulo e prévia de cada evento da Jornada, por tipo.

export function EventMetadataPreview({
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
            className="inline-flex items-center gap-1 text-success hover:underline"
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
export function deriveKindLabel(
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
