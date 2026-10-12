"use client";

import { useParams } from "next/navigation";
import { MinusIcon, PlusIcon, ThermometerIcon, TrophyIcon, XCircleIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTags } from "@/features/tags/hooks/use-tags";
import { useQueryParticipants } from "@/features/trackings/hooks/use-trackings";
import { useTrackingStatusNames } from "@/features/trackings/hooks/use-tracking-status-names";
import { cn } from "@/lib/utils";
import { TEMPERATURES, initialsOf } from "./action-card-preview";

// Visão "Ícones": o mínimo que diz o que o passo faz, sem abrir a configuração. O desenho no lugar
// do ícone (`IconNodeGlyph`) e uma linha embaixo do nome (`IconNodeCaption`).

type Fields = Record<string, unknown>;

const GLYPH_TYPES = new Set(["RESPONSIBLE", "TEMPERATURE", "WIN_LOSS"]);
const CAPTION_TYPES = new Set(["LEAD_TAGGED", "TAG", "MOVE_LEAD", "MOVE_LEAD_STATUS"]);
const MAX_TAG_CHIPS = 3;

function asFields(value: unknown): Fields {
  return value && typeof value === "object" ? (value as Fields) : {};
}

function nodeConfig(data: unknown): Fields {
  const fields = asFields(data);
  const action = asFields(fields.action);
  return Object.keys(action).length > 0 ? { ...fields, ...action } : fields;
}

export function hasIconGlyph(nodeType: string | undefined): boolean {
  return Boolean(nodeType) && GLYPH_TYPES.has(nodeType!);
}

export function hasIconCaption(nodeType: string | undefined): boolean {
  return Boolean(nodeType) && CAPTION_TYPES.has(nodeType!);
}

/** Selo de "entra" (verde) ou "sai" (vermelho) no canto do desenho. */
function ChangeBadge({ isRemoval }: { isRemoval: boolean }) {
  const Icon = isRemoval ? MinusIcon : PlusIcon;
  return (
    <span
      className={cn(
        "absolute -bottom-1 -right-1 grid size-3 place-items-center rounded-full border border-background text-white",
        isRemoval ? "bg-destructive" : "bg-success",
      )}
    >
      <Icon className="size-2" strokeWidth={4} />
    </span>
  );
}

function ResponsibleGlyph({ config }: { config: Fields }) {
  const { trackingId } = useParams<{ trackingId: string }>();
  const { participants } = useQueryParticipants({ trackingId });
  const responsible = config.responsible as { id?: string; name?: string } | null | undefined;
  const photoUrl = participants.find((participant) => participant.user.id === responsible?.id)?.user.image ?? "";
  return (
    <span className="relative block">
      <Avatar className="size-5">
        <AvatarImage src={photoUrl} alt={responsible?.name ?? ""} />
        <AvatarFallback className="text-[7px]">{responsible?.name ? initialsOf(responsible.name) : "?"}</AvatarFallback>
      </Avatar>
      <ChangeBadge isRemoval={config.type === "REMOVE"} />
    </span>
  );
}

export function IconNodeGlyph({ nodeType, data }: { nodeType: string; data: unknown }) {
  const config = nodeConfig(data);
  if (nodeType === "RESPONSIBLE") return <ResponsibleGlyph config={config} />;
  if (nodeType === "TEMPERATURE") {
    return <ThermometerIcon className={cn("size-4", TEMPERATURES[String(config.temperature ?? "")]?.colorClass ?? "text-muted-foreground")} />;
  }
  const isLoss = (config.type ?? config.winLossType) === "LOSS";
  return isLoss ? <XCircleIcon className="size-4 text-destructive" /> : <TrophyIcon className="size-4 text-success" />;
}

function TagChips({ tagIds, isRemoval }: { tagIds: string[]; isRemoval?: boolean }) {
  const { tags: allTags } = useTags({ trackingId: "ALL", includeArchived: true });
  if (tagIds.length === 0) return null;
  return (
    <span className="mt-1 flex flex-wrap items-center justify-center gap-1">
      {isRemoval !== undefined && (
        <span className={cn("text-[11px] font-bold leading-none", isRemoval ? "text-destructive" : "text-success")}>{isRemoval ? "−" : "+"}</span>
      )}
      {tagIds.slice(0, MAX_TAG_CHIPS).map((tagId) => {
        const tag = allTags.find((candidate) => candidate.id === tagId);
        return (
          <span
            key={tagId}
            className={cn("max-w-28 truncate rounded-full px-2 py-0.5 text-[10px] font-medium text-white", !tag && "bg-muted text-muted-foreground")}
            style={tag?.color ? { backgroundColor: tag.color } : undefined}
          >
            {tag?.name ?? "tag a escolher"}
          </span>
        );
      })}
      {tagIds.length > MAX_TAG_CHIPS && <span className="text-[10px] text-muted-foreground">+{tagIds.length - MAX_TAG_CHIPS}</span>}
    </span>
  );
}

function StatusCaption({ trackingId, statusId }: { trackingId: string | undefined; statusId: string }) {
  const { data: statusData } = useTrackingStatusNames(trackingId);
  const statuses = (statusData as { status?: { id: string; name: string }[] } | undefined)?.status ?? [];
  const statusName = statuses.find((status) => status.id === statusId)?.name;
  if (!statusName) return null;
  return <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">→ {statusName}</span>;
}

export function IconNodeCaption({ nodeType, data }: { nodeType: string; data: unknown }) {
  const { trackingId } = useParams<{ trackingId: string }>();
  const config = nodeConfig(data);
  if (nodeType === "LEAD_TAGGED") {
    const direct = Array.isArray(config.tagIds) ? (config.tagIds as unknown[]) : [];
    const fromConditions = Array.isArray(config.conditions)
      ? (config.conditions as Fields[])
          .filter((condition) => condition.type !== "NOT_CONTAINS_TAG")
          .flatMap((condition) => (Array.isArray(condition.tagIds) ? (condition.tagIds as unknown[]) : []))
      : [];
    return <TagChips tagIds={[...new Set([...direct, ...fromConditions].map(String))]} />;
  }
  if (nodeType === "TAG") {
    const tagIds = Array.isArray(config.tagsIds) ? (config.tagsIds as unknown[]).map(String) : [];
    return <TagChips tagIds={tagIds} isRemoval={config.type === "REMOVE"} />;
  }
  if (nodeType === "MOVE_LEAD") {
    return <StatusCaption trackingId={String(config.trackingId ?? "") || undefined} statusId={String(config.statusId ?? "")} />;
  }
  return <StatusCaption trackingId={trackingId} statusId={String(config.statusId ?? "")} />;
}
