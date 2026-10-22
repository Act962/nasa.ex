// Spec 0105: o canal por onde o lead chegou, com nome e ícone — uma lista só para Jornada, card e mensagens.
import {
  Bot,
  CalendarDays,
  Database,
  Facebook,
  FileText,
  Globe,
  Instagram,
  Linkedin,
  Link2,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  Music2,
  ShoppingBag,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

export type LeadChannelKey =
  | "NERP_CATALOG"
  | "LINNKER"
  | "INSTAGRAM_COMMENT"
  | "INSTAGRAM"
  | "FACEBOOK"
  | "ASTRO_CHAT"
  | "IN_CHAT"
  | "WHATSAPP"
  | "META_ADS"
  | "FORM"
  | "AGENDA"
  | "TIKTOK"
  | "LINKEDIN"
  | "GMAIL"
  | "GOOGLE_MAPS"
  | "ERP"
  | "DEFAULT"
  | "OTHER";

export const LEAD_CHANNELS: Record<LeadChannelKey, { label: string; icon: LucideIcon; color: string }> = {
  NERP_CATALOG: { label: "Catálogo online", icon: ShoppingBag, color: "#10b981" },
  LINNKER: { label: "Linnker", icon: Link2, color: "#0ea5e9" },
  INSTAGRAM_COMMENT: { label: "Instagram post", icon: Instagram, color: "#E1306C" },
  INSTAGRAM: { label: "Instagram Direct", icon: Instagram, color: "#C13584" },
  FACEBOOK: { label: "Facebook", icon: Facebook, color: "#1877F2" },
  ASTRO_CHAT: { label: "Site", icon: Globe, color: "#7c3aed" },
  IN_CHAT: { label: "Página de atendimento", icon: MessagesSquare, color: "#8b5cf6" },
  WHATSAPP: { label: "WhatsApp", icon: MessageCircle, color: "#25D366" },
  META_ADS: { label: "Anúncio da Meta", icon: Megaphone, color: "#0866FF" },
  FORM: { label: "Formulário", icon: FileText, color: "#3498db" },
  AGENDA: { label: "Agenda", icon: CalendarDays, color: "#e67e22" },
  TIKTOK: { label: "TikTok", icon: Music2, color: "#010101" },
  LINKEDIN: { label: "LinkedIn", icon: Linkedin, color: "#0077B5" },
  GMAIL: { label: "Gmail", icon: Mail, color: "#EA4335" },
  GOOGLE_MAPS: { label: "Google Maps", icon: MapPin, color: "#4285F4" },
  ERP: { label: "Carteira do ERP", icon: Database, color: "#0ea5e9" },
  DEFAULT: { label: "Cadastro manual", icon: UserPlus, color: "#95a5a6" },
  OTHER: { label: "Outro", icon: Bot, color: "#9b59b6" },
};

export type LeadChannelInput = {
  source: string;
  ctwaClid?: string | null;
  metaAdId?: string | null;
  /** Canal da conversa do lead (WHATSAPP, INSTAGRAM, FACEBOOK…). */
  conversationChannel?: string | null;
  hasLinnkerScan?: boolean;
};

function isChannelKey(value: string): value is LeadChannelKey {
  return value in LEAD_CHANNELS;
}

/**
 * Canal de origem (RF-3/RF-4). O `source` gravado vale primeiro; lead antigo que nasceu como `OTHER` é deduzido
 * pela conversa (Facebook) ou pela leitura do Linnker. Clique em anúncio da Meta aparece como "Anúncio da Meta".
 */
export function resolveLeadChannel(input: LeadChannelInput): LeadChannelKey {
  if (input.ctwaClid || input.metaAdId) return "META_ADS";
  if (input.source === "OTHER") {
    if (input.hasLinnkerScan) return "LINNKER";
    if (input.conversationChannel === "FACEBOOK") return "FACEBOOK";
  }
  return isChannelKey(input.source) ? input.source : "OTHER";
}

/**
 * Origem real (spec 0114) → nome e ícone. Reaproveita os canais acima e acrescenta as origens que não são canal
 * de conversa (site, trafeGO, campanha, integração, importação).
 */
export const LEAD_ORIGIN_DISPLAY: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  WHATSAPP: LEAD_CHANNELS.WHATSAPP,
  LINNKER: LEAD_CHANNELS.LINNKER,
  PAGES: { label: "Site", icon: Globe, color: "#7c3aed" },
  TRAFEGO: { label: "trafeGO", icon: Megaphone, color: "#f97316" },
  META_ADS: LEAD_CHANNELS.META_ADS,
  FORM: LEAD_CHANNELS.FORM,
  AGENDA: LEAD_CHANNELS.AGENDA,
  SITE_CHAT: { label: "Chat do site", icon: Globe, color: "#7c3aed" },
  IN_CHAT: LEAD_CHANNELS.IN_CHAT,
  INSTAGRAM_DIRECT: LEAD_CHANNELS.INSTAGRAM,
  INSTAGRAM_COMMENT: LEAD_CHANNELS.INSTAGRAM_COMMENT,
  FACEBOOK: LEAD_CHANNELS.FACEBOOK,
  CATALOG: LEAD_CHANNELS.NERP_CATALOG,
  CAMPANHA: { label: "Campanha", icon: Megaphone, color: "#0ea5e9" },
  API: { label: "Integração (API)", icon: Bot, color: "#64748b" },
  MANUAL: LEAD_CHANNELS.DEFAULT,
  IMPORT: { label: "Importação", icon: Database, color: "#64748b" },
};
