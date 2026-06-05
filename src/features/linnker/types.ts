export type LinnkerLinkType = "TRACKING" | "FORM" | "CHAT" | "EXTERNAL" | "AGENDA";
export type LinnkerButtonStyle = "rounded" | "sharp" | "pill";
export type LinnkerDisplayStyle = "button" | "banner";

export interface SocialLink {
  platform: string;
  url: string;
}

export interface LinnkerLink {
  id: string;
  pageId: string;
  title: string;
  description?: string | null;
  url: string;
  type: LinnkerLinkType;
  icon?: string | null;
  emoji?: string | null;
  imageUrl?: string | null;
  displayStyle: LinnkerDisplayStyle;
  color?: string | null;
  position: number;
  isActive: boolean;
  clicks: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface LinnkerPage {
  id: string;
  organizationId: string;
  userId: string;
  slug: string;
  title: string;
  bio?: string | null;
  avatarUrl?: string | null;
  coverColor: string;
  buttonStyle: LinnkerButtonStyle;
  isPublished: boolean;
  bannerUrl?: string | null;
  backgroundColor?: string | null;
  backgroundImage?: string | null;
  backgroundOpacity: number;
  socialLinks?: SocialLink[] | null;
  socialIconColor?: string | null;
  titleColor?: string | null;
  bioColor?: string | null;
  /** QR de contato — quando ON, perfil público mostra botão QR ao
   *  lado do avatar. Default true (vem do schema). */
  qrEnabled?: boolean;
  /** Mensagem template usada no `wa.me/<phone>?text=` quando alguém
   *  escaneia. Suporta `{org}` como placeholder. */
  qrMessageTemplate?: string | null;
  /** Overrides do vCard gerado pelo endpoint `/api/linnker/<slug>/vcard`.
   *  Quando vazio, cai nos defaults (title split, org.name, etc). */
  vcardOverrides?: {
    firstName?: string | null;
    lastName?: string | null;
    jobTitle?: string | null;
    company?: string | null;
    phone?: string | null;
    email?: string | null;
    birthday?: string | null;
    website?: string | null;
    notes?: string | null;
  } | null;
  links: LinnkerLink[];
  _count?: { scans: number };
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface LinnkerScan {
  id: string;
  pageId: string;
  leadId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  createdAt: Date | string;
  lead?: { id: string; name: string; email?: string | null; phone?: string | null } | null;
}

export const SOCIAL_PLATFORMS = [
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/usuario" },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/pagina" },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@usuario" },
  { key: "twitter", label: "X (Twitter)", placeholder: "https://x.com/usuario" },
  { key: "whatsapp", label: "WhatsApp", placeholder: "https://wa.me/5511999999999" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@canal" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/usuario" },
  { key: "website", label: "Website", placeholder: "https://meusite.com" },
] as const;
