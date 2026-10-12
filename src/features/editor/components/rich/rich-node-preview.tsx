"use client";

import { useParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { useTags } from "@/features/tags/hooks/use-tags";
import { useAiButtonPresets } from "@/features/tracking-settings/hooks/use-ai-button-presets";
import { useTrackingStatusNames } from "@/features/trackings/hooks/use-tracking-status-names";
import { LeadCardPreview, type LeadCardTag } from "./lead-card-preview";
import { MessagePhonePreview, type PhoneMessage } from "./message-phone-preview";
import { RICH_ACTION_TYPES, RICH_MESSAGE_TYPES, RICH_TRIGGER_TYPES } from "./rich-node-types";
import { ActionCardPreview } from "./action-card-preview";
import { useQueryInstances } from "@/features/tracking-settings/hooks/use-integration";

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
    return {
      kind: isDocument ? "document" : "image",
      text: withLeadPlaceholder(config.caption),
      label: String(config.fileName ?? ""),
      mediaUrl: String(config.url ?? ""),
    };
  }
  const payload = asFields(config.payload);
  switch (String(payload.type ?? "TEXT")) {
    case "IMAGE":
      return { kind: "image", text: withLeadPlaceholder(payload.caption), mediaUrl: String(payload.imageUrl ?? "") };
    case "DOCUMENT":
      return {
        kind: "document",
        text: withLeadPlaceholder(payload.caption),
        label: String(payload.fileName ?? ""),
        mediaUrl: String(payload.documentUrl ?? ""),
      };
    case "TEMPLATE":
      return {
        kind: "template",
        text: String(payload.bodyText ?? "") || "Mensagem de modelo aprovado pela Meta.",
        label: String(payload.templateName ?? ""),
        headerText: String(payload.headerText ?? ""),
      };
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

/** A mensagem de um quadro de envio como o cliente vê, a partir do que está salvo no passo. */
export function phoneMessageOf(nodeType: string, data: unknown, presetById: Map<string, Record<string, unknown>>): PhoneMessage {
  return toPhoneMessage(nodeType, nodeConfig(data), presetById);
}

/** "+55 86 9982-1810 · Clínica" ou "… · API oficial": por qual número a mensagem sai. */
function describeChannel(instance: unknown): string | undefined {
  if (!instance) return undefined;
  const channel = instance as { phoneNumber?: string | null; profileName?: string | null; instanceName?: string | null; provider?: string | null };
  const channelName = channel.provider === "META_CLOUD" ? "API oficial" : channel.profileName || channel.instanceName || "";
  const phoneNumber = channel.phoneNumber ? `+${String(channel.phoneNumber).replace(/\D/g, "")}` : "";
  return [phoneNumber, channelName].filter(Boolean).join(" · ") || undefined;
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
  description,
  icon: Icon,
  isUndelivered,
  optionOutputIds,
}: {
  /** Saídas por opção do menu salvo (spec 0098): só o editor passa; no Mapa o quadro é só leitura. */
  optionOutputIds?: (string | null)[];
  nodeType: string;
  data: unknown;
  name: string;
  /** Resumo que o próprio quadro já calcula (ex.: "2 produto(s)"), usado nos cartões dos Apps. */
  description?: string;
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
  // A mesma consulta que o editor já faz para as regras do canal: sai do cache.
  const { instance } = useQueryInstances(trackingId);

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
    return (
      <MessagePhonePreview
        message={toPhoneMessage(nodeType, config, presetById)}
        isUndelivered={isUndelivered}
        channelLabel={describeChannel(instance)}
        optionOutputIds={optionOutputIds}
      />
    );
  }
  if (RICH_ACTION_TYPES.has(nodeType)) {
    return <ActionCardPreview nodeType={nodeType} config={config} name={name} description={description} icon={Icon} />;
  }
  return null;
}
