/**
 * Single source of truth dos formatos de produto do NASA Route.
 *
 * Categorias:
 *   • lessons       — formatos com módulos/aulas (player de vídeo).
 *                     course | training | mentoring
 *   • ebook         — download direto de PDF/EPUB.
 *   • event         — evento ao vivo com data/hora + link de transmissão.
 *   • community     — link externo (WhatsApp, Telegram, Discord).
 *   • subscription  — cobrança recorrente em STARS por X dias.
 *
 * Cada formato tem viewer próprio (em components/student/viewers/) e seção
 * dedicada no form do criador (components/creator/forms/).
 */

export const COURSE_FORMATS = [
  "course",
  "training",
  "mentoring",
  "ebook",
  "event",
  "community",
  "subscription",
] as const;

export type CourseFormat = (typeof COURSE_FORMATS)[number];

export type FormatGroup =
  | "lessons"
  | "ebook"
  | "event"
  | "community"
  | "subscription";

export interface FormatMeta {
  /** Rótulo curto exibido em selects/cards. */
  label: string;
  /** Descrição usada em tooltips/help text. */
  description: string;
  /** Emoji simples — usado como ícone quando não há SVG. */
  icon: string;
  /** Categoria que define qual viewer renderizar e quais campos coletar. */
  group: FormatGroup;
}

export const FORMAT_META: Record<CourseFormat, FormatMeta> = {
  course: {
    label: "Curso",
    description: "Conteúdo organizado em módulos e aulas em vídeo.",
    icon: "🎓",
    group: "lessons",
  },
  training: {
    label: "Treinamento",
    description: "Programa intensivo, geralmente com prazo de conclusão.",
    icon: "🚀",
    group: "lessons",
  },
  mentoring: {
    label: "Mentoria",
    description: "Encontros + materiais entre criador e aluno.",
    icon: "🤝",
    group: "lessons",
  },
  ebook: {
    label: "eBook",
    description: "Arquivo PDF ou EPUB para download imediato após a compra.",
    icon: "📘",
    group: "ebook",
  },
  event: {
    label: "Evento Online",
    description: "Transmissão ao vivo com data/hora marcada (Zoom, Meet, YouTube).",
    icon: "📅",
    group: "event",
  },
  community: {
    label: "Comunidade",
    description: "Acesso a um grupo no WhatsApp, Telegram ou Discord.",
    icon: "💬",
    group: "community",
  },
  subscription: {
    label: "Assinatura",
    description: "Cobrança mensal recorrente em STARS para manter o acesso.",
    icon: "🔁",
    group: "subscription",
  },
};

/**
 * `course/training/mentoring` compartilham o mesmo player (módulos + aulas).
 * Outros formatos têm viewers próprios e não passam pelo player.
 */
export const hasLessons = (format: string): boolean =>
  FORMAT_META[format as CourseFormat]?.group === "lessons";

export const isCourseFormat = (value: string): value is CourseFormat =>
  (COURSE_FORMATS as readonly string[]).includes(value);

/** Retorna meta com fallback seguro para quando o BD tem um valor desconhecido. */
export const getFormatMeta = (format: string): FormatMeta =>
  FORMAT_META[format as CourseFormat] ?? FORMAT_META.course;

/**
 * Tipos válidos de comunidade. Usado pra renderizar ícone correto +
 * validar no Zod da procedure `creatorUpsertCourse`.
 */
export const COMMUNITY_TYPES = ["whatsapp", "telegram", "discord", "other"] as const;
export type CommunityType = (typeof COMMUNITY_TYPES)[number];

export const COMMUNITY_TYPE_LABELS: Record<CommunityType, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  discord: "Discord",
  other: "Outro",
};

/**
 * Períodos de assinatura. V1 só `monthly`. `yearly` reservado pra V2.
 */
export const SUBSCRIPTION_PERIODS = ["monthly", "yearly"] as const;
export type SubscriptionPeriod = (typeof SUBSCRIPTION_PERIODS)[number];

export const SUBSCRIPTION_PERIOD_LABELS: Record<SubscriptionPeriod, string> = {
  monthly: "Mensal",
  yearly: "Anual",
};

/**
 * Quantos dias dura cada período de assinatura. Usado pra calcular
 * `nextChargeAt` ao criar/renovar.
 */
export const SUBSCRIPTION_PERIOD_DAYS: Record<SubscriptionPeriod, number> = {
  monthly: 30,
  yearly: 365,
};
