import {
  CalendarIcon,
  ClipboardListIcon,
  KanbanIcon,
  LayoutTemplate,
  Link2,
  MessageCircleIcon,
  RectangleHorizontal,
  type LucideIcon,
} from "lucide-react";
import type { LinnkerDisplayStyle, LinnkerLinkType } from "../../types";

export const LINK_TYPE_OPTIONS: { value: LinnkerLinkType; label: string; icon: LucideIcon }[] = [
  { value: "EXTERNAL", label: "Link externo", icon: Link2 },
  { value: "TRACKING", label: "Tracking (funil de vendas)", icon: KanbanIcon },
  { value: "FORM", label: "Formulário", icon: ClipboardListIcon },
  { value: "CHAT", label: "Chat", icon: MessageCircleIcon },
  { value: "AGENDA", label: "Agenda", icon: CalendarIcon },
];

/** Emoji que o visitante vê no botão da página pública (conteúdo do cliente, não rótulo da plataforma). */
export const TYPE_DEFAULT_EMOJI: Record<LinnkerLinkType, string> = {
  EXTERNAL: "🔗",
  TRACKING: "📊",
  FORM: "📋",
  CHAT: "💬",
  AGENDA: "📅",
};

export const LINK_EMOJIS = [
  "🔗", "📋", "💬", "📅", "📊", "🚀", "⭐", "🎯",
  "📞", "💡", "🏆", "🎁", "🔥", "✅", "💎", "🎪",
];

/** `null` = usa a cor principal da página. Cores que o cliente escolhe para a página pública. */
export const LINK_COLORS: (string | null)[] = [
  null,
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#64748b",
  "#1e293b",
];

export const DISPLAY_STYLE_OPTIONS: {
  value: LinnkerDisplayStyle;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  { value: "button", label: "Botão", description: "Botão colorido com texto", icon: LayoutTemplate },
  { value: "banner", label: "Banner", description: "Imagem clicável", icon: RectangleHorizontal },
];

export interface NewLinkForm {
  title: string;
  url: string;
  type: LinnkerLinkType;
  emoji: string;
  imageUrl: string | null;
  displayStyle: LinnkerDisplayStyle;
  color: string | null;
  selectedResourceId: string;
}

export const EMPTY_NEW_LINK: NewLinkForm = {
  title: "",
  url: "",
  type: "EXTERNAL",
  emoji: TYPE_DEFAULT_EMOJI.EXTERNAL,
  imageUrl: null,
  displayStyle: "button",
  color: null,
  selectedResourceId: "",
};
