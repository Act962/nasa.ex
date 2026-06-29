import {
  BanIcon,
  FileIcon,
  ImageIcon,
  MapPinIcon,
  MicIcon,
  PhoneIcon,
  StickerIcon,
  UserIcon,
  VideoIcon,
} from "lucide-react";
import { parseCallPayload } from "./call-message-box";

/**
 * Preview compacto pra exibir como "última mensagem" no card de conversa
 * (sidebar do tracking-chat). Cobre todos os tipos: texto puro (com emojis
 * herdados naturalmente), foto, áudio, figurinha, vídeo, arquivo,
 * localização, contato, ligação (perdida/normal) e mensagem apagada.
 *
 * Devolve `{ icon, label, italic, danger }` pra render flexível —
 * mantemos `null` em campos opcionais quando não há ícone (texto puro).
 */
export interface MessagePreviewMeta {
  /** Ícone à esquerda (opcional). */
  icon: React.ComponentType<{ className?: string }> | null;
  /** Texto principal do preview. */
  label: string;
  /** True quando deve renderizar em itálico (ex: "Mensagem apagada"). */
  italic?: boolean;
  /** True quando o texto deve ser tingido (vermelho — ligação perdida). */
  danger?: boolean;
}

export function getMessagePreview(message: {
  body?: string | null;
  status?: string | null;
  mediaType?: string | null;
  mimetype?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): MessagePreviewMeta {
  // 1) Mensagem apagada (`MessageStatus.DELETED` no DB)
  if (message.status === "DELETED") {
    return {
      icon: BanIcon,
      label: "Mensagem apagada",
      italic: true,
    };
  }

  // 2) Ligações (voice_call / video_call) — usa o parser do CallMessageBox
  //    pra extrair status + duração do body JSON.
  const callPayload = parseCallPayload(message.body, message.mediaType);
  if (callPayload) {
    const isMissed =
      callPayload.status === "missed" || callPayload.status === "declined";
    const isVideo = callPayload.type === "video";
    const label = isVideo
      ? isMissed
        ? "Ligação de vídeo perdida"
        : "Ligação de vídeo"
      : isMissed
        ? "Ligação de voz perdida"
        : "Ligação de voz";
    return {
      icon: isVideo ? VideoIcon : PhoneIcon,
      label,
      danger: isMissed,
    };
  }

  // 3) Localização (lat/lng numéricos)
  if (
    message.latitude != null &&
    message.longitude != null &&
    Number.isFinite(message.latitude) &&
    Number.isFinite(message.longitude)
  ) {
    return { icon: MapPinIcon, label: "Localização" };
  }

  // 4) Contato (mediaType específico)
  if (message.mediaType === "contact") {
    return { icon: UserIcon, label: "Contato" };
  }

  // 5) Mídia por mimetype (foto, figurinha, áudio, vídeo, arquivo)
  if (message.mimetype) {
    if (message.mimetype.startsWith("image/")) {
      if (message.mimetype === "image/webp") {
        return { icon: StickerIcon, label: "Figurinha" };
      }
      return { icon: ImageIcon, label: "Foto" };
    }
    if (message.mimetype.startsWith("audio/")) {
      return { icon: MicIcon, label: "Áudio" };
    }
    if (message.mimetype.startsWith("video/")) {
      return { icon: VideoIcon, label: "Vídeo" };
    }
    return { icon: FileIcon, label: "Arquivo" };
  }

  // 6) Mídia anunciada via `mediaType` mas sem URL ainda (pending)
  if (message.mediaType === "image") {
    return { icon: ImageIcon, label: "Foto" };
  }
  if (message.mediaType === "audio") {
    return { icon: MicIcon, label: "Áudio" };
  }
  if (message.mediaType === "video") {
    return { icon: VideoIcon, label: "Vídeo" };
  }
  if (message.mediaType === "document") {
    return { icon: FileIcon, label: "Arquivo" };
  }
  if (message.mediaType === "sticker") {
    return { icon: StickerIcon, label: "Figurinha" };
  }

  // 7) Texto puro — emojis vem naturalmente como parte da string. Pra
  //    o caso de mensagens "negritadas" do WhatsApp (formato `*nome*\n...`)
  //    usado em grupos, extrai só a parte após o sender.
  const raw = message.body ?? "";
  const parts = raw.split("*");
  const cleaned = parts.length > 2 ? parts.slice(2).join("*").trim() : raw;
  return { icon: null, label: cleaned };
}
