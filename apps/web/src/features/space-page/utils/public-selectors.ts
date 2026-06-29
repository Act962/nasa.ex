/**
 * Selects Prisma pré-aprovados para rotas PÚBLICAS da Spacehome.
 *
 * REGRAS DE SEGURANÇA (§7 do plano):
 *  - Todas as procedures em `src/app/router/public/space/` DEVEM usar estes
 *    selectors ao invés de `include: true` ou selects ad-hoc.
 *  - NUNCA expor: email de login, telefone, tokens, sessions, companyCode,
 *    balances, metadata interna, IP cru, User Agent completo.
 *  - Dados adicionais (email, CV) só saem do servidor se o usuário tiver
 *    habilitado o toggle granular em `UserProfileCard`.
 */

export const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  image: true,
} as const;

export const PUBLIC_USER_MIN_SELECT = {
  id: true,
  name: true,
} as const;

export const PUBLIC_ORG_SELECT = {
  id: true,
  name: true,
  slug: true,
  logo: true,
  bio: true,
  bannerUrl: true,
  website: true,
  isSpacehomePublic: true,
  spacehomeTemplate: true,
  nasaPageId: true,
  city: true,
  state: true,
  country: true,
} as const;

export const PUBLIC_SPACE_STATION_SELECT = {
  id: true,
  nick: true,
  bio: true,
  avatarUrl: true,
  bannerUrl: true,
  theme: true,
  starsReceived: true,
  accessMode: true,
} as const;

export const PUBLIC_JOB_TITLE_SELECT = {
  id: true,
  title: true,
  slug: true,
  category: true,
  level: true,
} as const;

/**
 * Monta o "select" de um UserProfileCard público, removendo campos que
 * o usuário não habilitou. Sempre respeitar os toggles granulares.
 */
export function filterProfileCardByToggles<
  T extends {
    headline: string | null;
    bio: string | null;
    cvUrl: string | null;
    linkedinUrl: string | null;
    githubUrl: string | null;
    portfolioUrl: string | null;
    email: string | null;
    showHeadline: boolean;
    showBio: boolean;
    showCv: boolean;
    showLinkedin: boolean;
    showGithub: boolean;
    showPortfolio: boolean;
    showEmail: boolean;
  },
>(card: T) {
  return {
    headline: card.showHeadline ? card.headline : null,
    bio: card.showBio ? card.bio : null,
    cvUrl: card.showCv ? card.cvUrl : null,
    linkedinUrl: card.showLinkedin ? card.linkedinUrl : null,
    githubUrl: card.showGithub ? card.githubUrl : null,
    portfolioUrl: card.showPortfolio ? card.portfolioUrl : null,
    email: card.showEmail ? card.email : null,
  };
}
