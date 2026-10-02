import type { LinnkerButtonStyle, LinnkerPage, SocialLink } from "../../types";

/** Rascunho da aba Aparência: tudo o que o cliente edita antes de salvar. */

export const VCARD_FIELDS = [
  "firstName",
  "lastName",
  "jobTitle",
  "company",
  "phone",
  "email",
  "birthday",
  "website",
  "notes",
] as const;

export type VcardField = (typeof VCARD_FIELDS)[number];
export type VcardDraft = Record<VcardField, string>;

export interface AppearanceDraft {
  title: string;
  bio: string;
  coverColor: string;
  buttonStyle: LinnkerButtonStyle;
  avatarUrl: string | null;
  bannerUrl: string | null;
  backgroundColor: string;
  backgroundImage: string | null;
  backgroundOpacity: number;
  socialLinks: SocialLink[];
  socialIconColor: string;
  titleColor: string;
  bioColor: string;
  qrEnabled: boolean;
  qrMessageTemplate: string;
  vcard: VcardDraft;
}

export type UpdateAppearanceDraft = (patch: Partial<AppearanceDraft>) => void;

export const DEFAULT_QR_MESSAGE_TEMPLATE =
  "Olá! Te conheci pelo QR no evento. Quero saber mais sobre {org} 👋";

const DEFAULT_BACKGROUND_COLOR = "#f3f4f6";
const DEFAULT_SOCIAL_ICON_COLOR = "#52525b";
const DEFAULT_TITLE_COLOR = "#111827";
const DEFAULT_BIO_COLOR = "#6b7280";

export function buildAppearanceDraft(page: LinnkerPage): AppearanceDraft {
  const vcardOverrides = page.vcardOverrides ?? {};
  const vcard = Object.fromEntries(
    VCARD_FIELDS.map((field) => [field, vcardOverrides[field] ?? ""]),
  ) as VcardDraft;

  return {
    title: page.title,
    bio: page.bio ?? "",
    coverColor: page.coverColor,
    buttonStyle: page.buttonStyle,
    avatarUrl: page.avatarUrl ?? null,
    bannerUrl: page.bannerUrl ?? null,
    backgroundColor: page.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
    backgroundImage: page.backgroundImage ?? null,
    backgroundOpacity: page.backgroundOpacity ?? 0.15,
    socialLinks: (page.socialLinks as SocialLink[]) ?? [],
    socialIconColor: page.socialIconColor ?? DEFAULT_SOCIAL_ICON_COLOR,
    titleColor: page.titleColor ?? DEFAULT_TITLE_COLOR,
    bioColor: page.bioColor ?? DEFAULT_BIO_COLOR,
    qrEnabled: page.qrEnabled ?? true,
    qrMessageTemplate: page.qrMessageTemplate ?? DEFAULT_QR_MESSAGE_TEMPLATE,
    vcard,
  };
}

/** Campo vazio vira null (cai no padrão do gerador do .vcf); tudo vazio = sem personalização. */
export function toVcardOverrides(vcard: VcardDraft) {
  const overrides = Object.fromEntries(
    VCARD_FIELDS.map((field) => {
      const rawValue = field === "phone" ? vcard.phone.replace(/\D+/g, "") : vcard[field];
      return [field, rawValue.trim() || null];
    }),
  ) as Record<VcardField, string | null>;
  const hasAnyOverride = Object.values(overrides).some(Boolean);
  return hasAnyOverride ? overrides : null;
}

export function toPreviewOverride(draft: AppearanceDraft): Partial<LinnkerPage> {
  return {
    title: draft.title,
    bio: draft.bio || null,
    coverColor: draft.coverColor,
    buttonStyle: draft.buttonStyle,
    avatarUrl: draft.avatarUrl,
    bannerUrl: draft.bannerUrl,
    backgroundColor: draft.backgroundColor,
    backgroundImage: draft.backgroundImage,
    backgroundOpacity: draft.backgroundOpacity,
    socialLinks: draft.socialLinks.length > 0 ? draft.socialLinks : null,
    socialIconColor: draft.socialIconColor,
    titleColor: draft.titleColor,
    bioColor: draft.bioColor,
  };
}

/** Número do WhatsApp (dos links sociais) usado no QR de contato; null quando não há. */
export function extractPreviewPhone(socialLinks: SocialLink[]) {
  const whatsappLink = socialLinks.find((socialLink) => socialLink.platform?.toLowerCase() === "whatsapp");
  if (!whatsappLink?.url) return null;
  const digits = whatsappLink.url.replace(/\D+/g, "");
  if (digits.length < 8) return null;
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}
