"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { ThermometerIcon, TrophyIcon, XCircleIcon, type LucideIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTags } from "@/features/tags/hooks/use-tags";
import { useQueryParticipants, useQueryTrackings } from "@/features/trackings/hooks/use-trackings";
import { useTrackingStatusNames } from "@/features/trackings/hooks/use-tracking-status-names";
import { cn } from "@/lib/utils";

// Cartão de resumo dos quadros de ação na visão "Visual" (spec 0090, seção B): o que o passo faz,
// lido do `data` do quadro, sem precisar abrir a configuração.

type Fields = Record<string, unknown>;

interface ActionCardProps {
  nodeType: string;
  config: Fields;
  name: string;
  description?: string;
  icon?: LucideIcon | string;
}

export const TEMPERATURES: Record<string, { label: string; colorClass: string }> = {
  COLD: { label: "Frio", colorClass: "text-temp-cold" },
  WARM: { label: "Quente", colorClass: "text-temp-warm" },
  HOT: { label: "Muito quente", colorClass: "text-temp-hot" },
  VERY_HOT: { label: "Quentíssimo", colorClass: "text-temp-very-hot" },
};
const FILTER_FIELD_LABELS: Record<string, string> = {
  status: "Status",
  tag: "Tag",
  value: "Valor",
  name: "Nome",
  email: "E-mail",
  leadMessage: "Mensagem",
  interest: "Interesse",
};
const FILTER_OPERATOR_LABELS: Record<string, string> = {
  is: "é",
  is_not: "não é",
  contains: "contém",
  not_contains: "não contém",
  greater_than: "maior que",
  less_than: "menor que",
  equals: "igual a",
  at_least: "pelo menos",
};
const INTEREST_LABELS: Record<string, string> = { LOW: "Baixo", MEDIUM: "Médio", HIGH: "Alto" };
const MAX_FILTER_LINES = 4;
const MAX_TAG_CHIPS = 4;

export function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function CardShell({ icon: Icon, title, children }: { icon?: LucideIcon | string; title: string; children?: ReactNode }) {
  return (
    <div className="w-[184px] rounded-xl bg-card px-2.5 py-2 text-left">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {typeof Icon === "string" ? (
          <Image src={Icon} alt="" width={12} height={12} />
        ) : Icon ? (
          <Icon className="size-3 shrink-0" />
        ) : null}
        <span className="truncate">{title}</span>
      </div>
      {children && <div className="mt-1 text-[11.5px] leading-snug">{children}</div>}
    </div>
  );
}

function Pending({ text }: { text: string }) {
  return <span className="text-muted-foreground">{text}</span>;
}

function ResponsibleCard({ config, icon }: Pick<ActionCardProps, "config" | "icon">) {
  const { trackingId } = useParams<{ trackingId: string }>();
  const { participants } = useQueryParticipants({ trackingId });
  const responsible = config.responsible as { id?: string; name?: string } | null | undefined;
  const isRemoval = config.type === "REMOVE";
  const photoUrl = participants.find((participant) => participant.user.id === responsible?.id)?.user.image ?? "";
  return (
    <CardShell icon={icon} title={isRemoval ? "Remover responsável" : "Adicionar responsável"}>
      {responsible?.name ? (
        <span className="flex items-center gap-1.5">
          <Avatar className="size-5">
            <AvatarImage src={photoUrl} alt="" />
            <AvatarFallback className="text-[8px]">{initialsOf(responsible.name)}</AvatarFallback>
          </Avatar>
          <span className="truncate font-medium">{responsible.name}</span>
        </span>
      ) : (
        <Pending text="Escolha o responsável" />
      )}
    </CardShell>
  );
}

function MoveLeadCard({ config, icon }: Pick<ActionCardProps, "config" | "icon">) {
  const targetTrackingId = String(config.trackingId ?? "");
  const statusId = String(config.statusId ?? "");
  const { trackings } = useQueryTrackings();
  const { data: statusData } = useTrackingStatusNames(targetTrackingId || undefined);
  const statuses = (statusData as { status?: { id: string; name: string }[] } | undefined)?.status ?? [];
  const trackingName = trackings.find((tracking) => tracking.id === targetTrackingId)?.name;
  const statusName = statuses.find((status) => status.id === statusId)?.name;
  return (
    <CardShell icon={icon} title="Mover lead">
      {trackingName || statusName ? (
        <>
          <span className="block truncate text-muted-foreground">{trackingName ?? "Funil"}</span>
          <span className="block truncate font-medium">→ {statusName ?? "escolha a coluna"}</span>
        </>
      ) : (
        <Pending text="Escolha o funil e a coluna" />
      )}
    </CardShell>
  );
}

function TagCard({ config, icon }: Pick<ActionCardProps, "config" | "icon">) {
  const { tags: allTags } = useTags({ trackingId: "ALL", includeArchived: true });
  const tagIds = Array.isArray(config.tagsIds) ? (config.tagsIds as unknown[]).map(String) : [];
  const isRemoval = config.type === "REMOVE";
  return (
    <CardShell icon={icon} title={isRemoval ? "Remover tag" : "Adicionar tag"}>
      {tagIds.length === 0 ? (
        <Pending text="Escolha a tag" />
      ) : (
        <span className="flex flex-wrap gap-1">
          {tagIds.slice(0, MAX_TAG_CHIPS).map((tagId) => {
            const tag = allTags.find((candidate) => candidate.id === tagId);
            return (
              <span
                key={tagId}
                className={cn("max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-medium text-white", !tag && "bg-muted text-muted-foreground")}
                style={tag?.color ? { backgroundColor: tag.color } : undefined}
              >
                {tag?.name ?? "tag a escolher"}
              </span>
            );
          })}
          {tagIds.length > MAX_TAG_CHIPS && <span className="text-[10px] text-muted-foreground">+{tagIds.length - MAX_TAG_CHIPS}</span>}
        </span>
      )}
    </CardShell>
  );
}

function FilterCard({ config, icon }: Pick<ActionCardProps, "config" | "icon">) {
  const { trackingId } = useParams<{ trackingId: string }>();
  const { tags: allTags } = useTags({ trackingId: "ALL", includeArchived: true });
  const { data: statusData } = useTrackingStatusNames(trackingId);
  const statuses = (statusData as { status?: { id: string; name: string }[] } | undefined)?.status ?? [];
  const conditions = Array.isArray(config.conditions) ? (config.conditions as Fields[]) : [];
  const joiner = config.logic === "or" ? "OU" : "E";

  const describeValue = (condition: Fields): string => {
    const values = Array.isArray(condition.value) ? (condition.value as unknown[]).map(String) : [String(condition.value ?? "")];
    if (condition.field === "status") return values.map((statusId) => statuses.find((status) => status.id === statusId)?.name ?? "coluna").join(", ");
    if (condition.field === "tag") return values.map((tagId) => allTags.find((tag) => tag.id === tagId)?.name ?? "tag").join(", ");
    if (condition.field === "interest") return INTEREST_LABELS[values[0]] ?? values[0];
    return values.join(", ");
  };

  return (
    <CardShell icon={icon} title="Só segue se">
      {conditions.length === 0 ? (
        <Pending text="Defina a condição" />
      ) : (
        <span className="grid gap-0.5">
          {conditions.slice(0, MAX_FILTER_LINES).map((condition, conditionIndex) => (
            <span key={conditionIndex} className="block">
              {conditionIndex > 0 && <span className="mr-1 rounded bg-muted px-1 text-[9px] font-bold text-muted-foreground">{joiner}</span>}
              <span className="text-muted-foreground">
                {FILTER_FIELD_LABELS[String(condition.field)] ?? String(condition.field)}{" "}
                {FILTER_OPERATOR_LABELS[String(condition.operator)] ?? String(condition.operator)}{" "}
              </span>
              <span className="font-medium">{describeValue(condition)}</span>
            </span>
          ))}
          {conditions.length > MAX_FILTER_LINES && (
            <span className="text-[10px] text-muted-foreground">e mais {conditions.length - MAX_FILTER_LINES}</span>
          )}
        </span>
      )}
    </CardShell>
  );
}

export function ActionCardPreview({ nodeType, config, name, description, icon }: ActionCardProps) {
  if (nodeType === "RESPONSIBLE") return <ResponsibleCard config={config} icon={icon} />;
  if (nodeType === "MOVE_LEAD") return <MoveLeadCard config={config} icon={icon} />;
  if (nodeType === "TAG") return <TagCard config={config} icon={icon} />;
  if (nodeType === "FILTER_LEAD") return <FilterCard config={config} icon={icon} />;
  if (nodeType === "WIN_LOSS") {
    const isLoss = (config.type ?? config.winLossType) === "LOSS";
    return (
      <div className={cn("flex w-[150px] items-center gap-2 rounded-xl bg-card px-3 py-2.5 text-[12.5px] font-semibold", isLoss ? "text-destructive" : "text-success")}>
        {isLoss ? <XCircleIcon className="size-4 shrink-0" /> : <TrophyIcon className="size-4 shrink-0" />}
        {isLoss ? "Lead Perdido" : "Lead Ganho"}
      </div>
    );
  }
  if (nodeType === "TEMPERATURE") {
    const temperature = TEMPERATURES[String(config.temperature ?? "")];
    return (
      <div className="flex w-[150px] items-center gap-2 rounded-xl bg-card px-3 py-2.5 text-[12.5px] font-semibold">
        <ThermometerIcon className={cn("size-5 shrink-0", temperature?.colorClass ?? "text-muted-foreground")} />
        <span className={temperature?.colorClass}>{temperature?.label ?? "Escolha a temperatura"}</span>
      </div>
    );
  }
  return (
    <CardShell icon={icon} title={name}>
      {description ? <span className="line-clamp-2">{description}</span> : null}
    </CardShell>
  );
}
