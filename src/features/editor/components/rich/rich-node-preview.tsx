"use client";

import { useParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { useTags } from "@/features/tags/hooks/use-tags";
import { useAiButtonPresets } from "@/features/tracking-settings/hooks/use-ai-button-presets";
import { useTrackingStatusNames } from "@/features/trackings/hooks/use-tracking-status-names";
import { LeadCardPreview, type LeadCardTag } from "./lead-card-preview";
import { MessagePhonePreview, type PhoneMessage } from "./message-phone-preview";
import { RICH_MESSAGE_TYPES, RICH_TRIGGER_TYPES } from "./rich-node-types";

// Desenho dos quadros na visão "Visual" (spec 0090, seção B): um lugar só decide o que cada tipo
// mostra, a partir do `type` e do `data` do quadro. Os arquivos de cada quadro não mudam.

type Fields = Record<string, unknown>;

function asFields(value: unknown): Fields {
  return value && typeof value === "object" ? (value as Fields) : {};
}

/** Quadros clássicos guardam a configuração em `data.action`; os de modo agente, direto em `data`. */
function nodeConfig(data: unknown): Fields {
  const fields = asFields(data);
  const action = asFields(fields.action);
  return Object.keys(action).length > 0 ? { ...fields, ...action } : fields;
}

const LEAD_NAME_VARIABLE = /\{\{\s*(lead\.name|nome|name)\s*\}\}/gi;

function withLeadPlaceholder(text: unknown): string {
  return String(text ?? "").replace(LEAD_NAME_VARIABLE, "Nome do lead");
}

function toPhoneMessage(nodeType: string, config: Fields, presetById: Map<string, Fields>): PhoneMessage {
  if (nodeType === "SEND_VOICE") return { kind: "voice", text: withLeadPlaceholder(config.text) };
  if (nodeType === "SEND_MEDIA") {
    const isDocument = String(config.mediaType ?? "IMAGE").toUpperCase() === "DOCUMENT";
    return { kind: isDocument ? "document" : "image", text: withLeadPlaceholder(config.caption), label: String(config.fileName ?? "") };
  }
  const payload = asFields(config.payload);
  switch (String(payload.type ?? "TEXT")) {
    case "IMAGE":
      return { kind: "image", text: withLeadPlaceholder(payload.caption) };
    case "DOCUMENT":
      return { kind: "document", text: withLeadPlaceholder(payload.caption), label: String(payload.fileName ?? "") };
    case "TEMPLATE":
      return { kind: "template", text: "Mensagem de modelo aprovado pela Meta.", label: String(payload.templateName ?? "") };
    case "BUTTONS": {
      const preset = payload.mode === "preset" ? presetById.get(String(payload.presetId ?? "")) : undefined;
      const source = preset ?? payload;
      const buttons = Array.isArray(source.buttons) ? (source.buttons as Fields[]) : [];
      return {
        kind: "buttons",
        text: withLeadPlaceholder(source.bodyText),
        options: buttons.map((button) => String(button.text ?? "")),
      };
    }
    default:
      return { kind: "text", text: withLeadPlaceholder(payload.message) };
  }
}

function triggerTagIds(config: Fields): string[] {
  const direct = Array.isArray(config.tagIds) ? (config.tagIds as unknown[]) : [];
  const fromConditions = Array.isArray(config.conditions)
    ? (config.conditions as Fields[])
        .filter((condition) => condition.type !== "NOT_CONTAINS_TAG")
        .flatMap((condition) => (Array.isArray(condition.tagIds) ? (condition.tagIds as unknown[]) : []))
    : [];
  return [...new Set([...direct, ...fromConditions].map(String))];
}

export function RichNodePreview({
  nodeType,
  data,
  name,
  icon: Icon,
  isUndelivered,
}: {
  nodeType: string;
  data: unknown;
  name: string;
  icon?: LucideIcon | string;
  /** Erro previsto de entrega: o balão aparece esmaecido. */
  isUndelivered?: boolean;
}) {
  const { trackingId } = useParams<{ trackingId: string }>();
  const config = nodeConfig(data);
  const isTrigger = RICH_TRIGGER_TYPES.has(nodeType);
  const isMessage = RICH_MESSAGE_TYPES.has(nodeType);
  // A mesma consulta de tags que o quadro "Lead com Tag" já faz: sai do cache.
  const { tags: allTags } = useTags({ trackingId: "ALL", includeArchived: true });
  const { data: statusData } = useTrackingStatusNames(trackingId);
  const { presets } = useAiButtonPresets(trackingId);

  if (isTrigger) {
    const tags: LeadCardTag[] =
      nodeType === "LEAD_TAGGED"
        ? triggerTagIds(config).map((tagId) => {
            const tag = allTags.find((candidate) => candidate.id === tagId);
            return { id: tagId, name: tag?.name ?? "tag removida", color: tag?.color };
          })
        : [];
    const statusId = String(config.statusId ?? "");
    const statuses = (statusData as { status?: { id: string; name: string }[] } | undefined)?.status ?? [];
    const statusName = nodeType === "MOVE_LEAD_STATUS" ? statuses.find((status) => status.id === statusId)?.name : undefined;
    return (
      <LeadCardPreview
        caption={statusName ? `Entrou em: ${statusName}` : name}
        tags={tags}
        badge={Icon && typeof Icon !== "string" ? <Icon className="size-3.5" /> : undefined}
      />
    );
  }

  if (isMessage) {
    const presetById = new Map(presets.map((preset) => [String((preset as Fields).id), preset as Fields]));
    return <MessagePhonePreview message={toPhoneMessage(nodeType, config, presetById)} isUndelivered={isUndelivered} />;
  }
  return null;
}
