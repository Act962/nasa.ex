import type { Message } from "../../types";

export type TextPayload = { kind: "text"; body: string };

export type MediaPayload = {
  kind: "media";
  mediaUrl: string;
  mediaType?: string;
  mimetype?: string;
  fileName?: string;
  body?: string;
};

export type ContactPayload = {
  kind: "contact";
  contactName: string;
  contactPhone: string;
};

export type LocationPayload = {
  kind: "location";
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
};

export type ForwardPayload =
  | TextPayload
  | MediaPayload
  | ContactPayload
  | LocationPayload;

export function isForwardable(message: Message): boolean {
  if (message.latitude != null && message.longitude != null) return true;
  if (message.mediaType === "contact" && message.fileName) return true;
  if (message.mediaUrl) return true;
  if (message.body?.trim()) return true;
  return false;
}

export function buildForwardPayload(message: Message): ForwardPayload {
  if (message.latitude != null && message.longitude != null) {
    const parts = (message.body ?? "").split(" — ");
    return {
      kind: "location",
      latitude: message.latitude,
      longitude: message.longitude,
      name: parts[0] || undefined,
      address: parts[1] || undefined,
    };
  }
  if (message.mediaType === "contact") {
    return {
      kind: "contact",
      contactName: message.body ?? "",
      contactPhone: message.fileName ?? "",
    };
  }
  if (message.mediaUrl) {
    return {
      kind: "media",
      mediaUrl: message.mediaUrl,
      mediaType: message.mediaType ?? undefined,
      mimetype: message.mimetype ?? undefined,
      fileName: message.fileName ?? undefined,
      body: message.body ?? undefined,
    };
  }
  return { kind: "text", body: message.body ?? "" };
}

export function forwardPreviewText(payload: ForwardPayload): string {
  switch (payload.kind) {
    case "text":
      return payload.body;
    case "contact":
      return `👤 ${payload.contactName}`;
    case "location":
      return `📍 ${payload.name ?? payload.address ?? "Localização"}`;
    case "media": {
      if (payload.body?.trim()) return payload.body;
      if (payload.fileName) return payload.fileName;
      if (
        payload.mediaType === "image" ||
        payload.mimetype?.startsWith("image/")
      )
        return "📷 Imagem";
      if (
        payload.mediaType === "video" ||
        payload.mimetype?.startsWith("video/")
      )
        return "🎬 Vídeo";
      if (
        payload.mediaType === "audio" ||
        payload.mimetype?.startsWith("audio/")
      )
        return "🎵 Áudio";
      return "📎 Mídia";
    }
  }
}
