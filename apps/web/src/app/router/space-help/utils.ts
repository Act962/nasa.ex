import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { StarTransactionType, WhatsAppInstanceStatus } from "@/generated/prisma/enums";
import { pusherServer } from "@/lib/pusher";

// ─── Setup Inicial NASA — recompensas ao chegar a 100% ─────────────────
const SETUP_REWARD_STARS = 50;
const SETUP_REWARD_SP = 100;
const SETUP_BADGE_SLUG = "org-ready";

// ─── Rota de Conhecimento — gate de aulas pelo passo do setup ──────────
// Aulas só podem ser marcadas como concluídas quando o passo real do
// setup correspondente já estiver completo no banco (ex: aula sobre
// WhatsApp só conclui se houver instância WhatsApp conectada).
//
// `null` = aula sem gate (pode ser concluída livremente).
export const SETUP_TRACK_SLUG = "setup-inicial-nasa";

const TRACK_LESSON_GATES: Record<string, Array<SetupStepKey | null>> = {
  // Setup Inicial NASA — espelha 1:1 os 5 passos críticos.
  "setup-inicial-nasa": ["whatsapp", "company", "tracking-tag", "workspace", "forge"],
  // Comece com NASA — aulas práticas exigem o passo correspondente.
  "comece-com-nasa": [null, null, "tracking-tag", "whatsapp", null],
  // Escale seu Comercial — pipeline depende de Tracking; propostas, do Forge.
  "escale-comercial": ["tracking-tag", "forge", null, null],
  // Domine o Atendimento — atendimento depende de WhatsApp conectado.
  "domine-atendimento": ["whatsapp", "whatsapp", null, null],
};

export function getRequiredSetupStepForLesson(
  trackSlug: string,
  lessonOrder: number,
): SetupStepKey | null {
  const map = TRACK_LESSON_GATES[trackSlug];
  if (!map) return null;
  return map[lessonOrder] ?? null;
}

export function trackHasGatedLessons(trackSlug: string): boolean {
  const map = TRACK_LESSON_GATES[trackSlug];
  if (!map) return false;
  return map.some((step) => step !== null);
}

const isFilled = (s: string | null | undefined): boolean =>
  typeof s === "string" && s.trim().length > 0;

/**
 * Space Help é conteúdo global da plataforma NASA — apenas usuários com
 * `User.isSystemAdmin = true` podem editar. Owner de empresa NÃO tem acesso.
 * Sempre valida no banco, nunca confia em cache de sessão.
 */
export async function requireModerator(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSystemAdmin: true },
  });
  if (!user?.isSystemAdmin) {
    throw new ORPCError("FORBIDDEN", {
      message: "Apenas moderadores da plataforma NASA podem editar o Space Help",
    });
  }
  return user;
}

export async function isModerator(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSystemAdmin: true },
  });
  return !!user?.isSystemAdmin;
}

/**
 * Credita as recompensas de uma trilha concluída:
 * - Space Points (cria SpacePointTransaction + atualiza UserSpacePoint)
 * - Stars (cria StarTransaction + atualiza Organization.starsBalance)
 * - Selo (cria UserSpaceHelpBadge — único por (user, badge))
 *
 * Idempotente: se já existir UserSpaceHelpBadge para o badge, não credita novamente.
 */
export async function awardTrackRewards(opts: {
  userId: string;
  orgId: string;
  trackId: string;
}): Promise<{
  starsAwarded: number;
  spAwarded: number;
  badge: { id: string; name: string; iconUrl: string | null; color: string | null } | null;
}> {
  const { userId, orgId, trackId } = opts;

  const track = await prisma.spaceHelpTrack.findUnique({
    where: { id: trackId },
    include: { rewardBadge: true },
  });
  if (!track) return { starsAwarded: 0, spAwarded: 0, badge: null };

  // Verifica se selo já foi concedido (evita duplicação de recompensa)
  let alreadyAwarded = false;
  if (track.rewardBadgeId) {
    const existing = await prisma.userSpaceHelpBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId: track.rewardBadgeId } },
    });
    alreadyAwarded = !!existing;
  }
  if (alreadyAwarded) {
    return {
      starsAwarded: 0,
      spAwarded: 0,
      badge: track.rewardBadge
        ? {
            id: track.rewardBadge.id,
            name: track.rewardBadge.name,
            iconUrl: track.rewardBadge.iconUrl,
            color: track.rewardBadge.color,
          }
        : null,
    };
  }

  // 1) Space Points
  let spAwarded = 0;
  if (track.rewardSpacePoints > 0) {
    const userPoint = await prisma.userSpacePoint.upsert({
      where: { userId },
      create: { userId, orgId },
      update: {},
    });
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + mondayOffset);
    thisMonday.setHours(0, 0, 0, 0);
    const isSameWeek = userPoint.weekStart && userPoint.weekStart >= thisMonday;
    const newWeekly = (isSameWeek ? userPoint.weeklyPoints : 0) + track.rewardSpacePoints;
    const newTotal = userPoint.totalPoints + track.rewardSpacePoints;

    await prisma.$transaction([
      prisma.spacePointTransaction.create({
        data: {
          userPointId: userPoint.id,
          points: track.rewardSpacePoints,
          description: `Rota concluída: ${track.title}`,
          metadata: { source: "spacehelp", trackId, trackSlug: track.slug } as any,
        },
      }),
      prisma.userSpacePoint.update({
        where: { id: userPoint.id },
        data: {
          totalPoints: newTotal,
          weeklyPoints: newWeekly,
          weekStart: isSameWeek ? userPoint.weekStart : thisMonday,
        },
      }),
    ]);
    spAwarded = track.rewardSpacePoints;
  }

  // 2) Stars
  let starsAwarded = 0;
  if (track.rewardStars > 0) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { starsBalance: true },
    });
    if (org) {
      const newBalance = org.starsBalance + track.rewardStars;
      await prisma.$transaction([
        prisma.organization.update({
          where: { id: orgId },
          data: { starsBalance: newBalance },
        }),
        prisma.starTransaction.create({
          data: {
            organizationId: orgId,
            type: StarTransactionType.MANUAL_ADJUST,
            amount: track.rewardStars,
            balanceAfter: newBalance,
            description: `Space Help — Rota concluída: ${track.title}`,
            appSlug: "spacehelp",
          },
        }),
      ]);
      starsAwarded = track.rewardStars;
    }
  }

  // 3) Selo
  let awardedBadge: { id: string; name: string; iconUrl: string | null; color: string | null } | null = null;
  if (track.rewardBadgeId && track.rewardBadge) {
    await prisma.userSpaceHelpBadge.create({
      data: {
        userId,
        badgeId: track.rewardBadgeId,
        trackId,
      },
    });
    awardedBadge = {
      id: track.rewardBadge.id,
      name: track.rewardBadge.name,
      iconUrl: track.rewardBadge.iconUrl,
      color: track.rewardBadge.color,
    };
  }

  // 4) Notifica via Pusher (popup celebratório)
  try {
    await pusherServer.trigger(`private-user-${userId}`, "spacehelp:track-completed", {
      trackId,
      trackTitle: track.title,
      starsAwarded,
      spAwarded,
      badge: awardedBadge,
    });
  } catch (err) {
    console.error("[space-help/awardTrackRewards] pusher error:", err);
  }

  return { starsAwarded, spAwarded, badge: awardedBadge };
}

// ════════════════════════════════════════════════════════════════════════
// Setup Inicial NASA — progresso e recompensa de configuração
// ════════════════════════════════════════════════════════════════════════

export type SetupStepKey =
  | "whatsapp"
  | "company"
  | "company-profile"
  | "tracking-tag"
  | "workspace"
  | "forge";

export interface SetupStep {
  key: SetupStepKey;
  label: string;
  description: string;
  isCompleted: boolean;
  helpCategorySlug: string;
  helpFeatureSlug: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface SetupProgress {
  steps: SetupStep[];
  completedCount: number;
  totalCount: number;
  percent: number;
  isFullyCompleted: boolean;
  rewardClaimed: boolean;
  rewardStars: number;
  rewardSpacePoints: number;
}

/**
 * Calcula o progresso dos 5 passos críticos de onboarding da plataforma.
 * Cada passo é validado contra o estado real do banco da organização.
 */
export async function computeSetupProgress(opts: {
  userId: string;
  orgId: string;
}): Promise<SetupProgress> {
  const { userId, orgId } = opts;

  const [
    whatsappCount,
    org,
    trackingCount,
    tagCount,
    projectCount,
    productCount,
    orgReadyBadge,
    membersWithCargoCount,
  ] = await Promise.all([
    prisma.whatsAppInstance.count({
      where: { organizationId: orgId, status: WhatsAppInstanceStatus.CONNECTED },
    }),
    prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        name: true,
        logo: true,
        companyCode: true,
        companyType: true,
      },
    }),
    prisma.tracking.count({ where: { organizationId: orgId } }),
    prisma.tag.count({ where: { organizationId: orgId } }),
    prisma.orgProject.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.forgeProduct.count({ where: { organizationId: orgId } }),
    prisma.spaceHelpBadge.findUnique({ where: { slug: SETUP_BADGE_SLUG } }),
    prisma.member.count({
      where: { organizationId: orgId, cargo: { not: null } },
    }),
  ]);

  const existingBadge = orgReadyBadge
    ? await prisma.userSpaceHelpBadge.findUnique({
        where: { userId_badgeId: { userId, badgeId: orgReadyBadge.id } },
      })
    : null;

  const companyFilled =
    isFilled(org?.name) && isFilled(org?.logo) && isFilled(org?.companyCode);

  const companyProfileFilled =
    isFilled(org?.companyType) && membersWithCargoCount > 0;

  const steps: SetupStep[] = [
    {
      key: "whatsapp",
      label: "Conectar instância WhatsApp",
      description: "Conecte seu número WhatsApp para receber mensagens dentro do NASA.",
      isCompleted: whatsappCount > 0,
      helpCategorySlug: "integrations",
      helpFeatureSlug: "conectar-instancia-whatsapp",
      ctaLabel: "Conectar agora",
      ctaHref: "/integrations",
    },
    {
      key: "company",
      label: "Configurar dados da empresa",
      description: "Nome, logo e código da empresa — base de identidade que aparece em propostas e contratos.",
      isCompleted: companyFilled,
      helpCategorySlug: "settings",
      helpFeatureSlug: "configurar-empresa",
      ctaLabel: "Preencher",
      ctaHref: "/settings",
    },
    {
      key: "company-profile",
      label: "Definir tipo de empresa + cargo do time",
      description:
        "Selecione o segmento da sua empresa e atribua o cargo hierárquico de pelo menos um membro.",
      isCompleted: companyProfileFilled,
      helpCategorySlug: "settings",
      helpFeatureSlug: "configurar-empresa",
      ctaLabel: "Configurar",
      ctaHref: "/settings/company",
    },
    {
      key: "tracking-tag",
      label: "Criar primeiro Tracking + Tag",
      description: "Pipeline visual + organização de leads desde o dia zero.",
      isCompleted: trackingCount > 0 && tagCount > 0,
      helpCategorySlug: "tracking",
      helpFeatureSlug: "criar-primeira-tag",
      ctaLabel: "Abrir Tracking",
      ctaHref: "/tracking",
    },
    {
      key: "workspace",
      label: "Configurar Workspace",
      description: "Crie seu primeiro projeto/cliente no Workspace.",
      isCompleted: projectCount > 0,
      helpCategorySlug: "workspace",
      helpFeatureSlug: "configurar-workspace",
      ctaLabel: "Abrir Workspace",
      ctaHref: "/workspace",
    },
    {
      key: "forge",
      label: "Cadastrar produtos no Forge",
      description: "Catálogo de produtos pra montar suas primeiras propostas.",
      isCompleted: productCount > 0,
      helpCategorySlug: "forge",
      helpFeatureSlug: "cadastrar-primeiro-produto",
      ctaLabel: "Cadastrar produto",
      ctaHref: "/forge",
    },
  ];

  const completedCount = steps.filter((s) => s.isCompleted).length;
  const totalCount = steps.length;
  const percent = Math.round((completedCount / totalCount) * 100);
  const isFullyCompleted = completedCount === totalCount;

  return {
    steps,
    completedCount,
    totalCount,
    percent,
    isFullyCompleted,
    rewardClaimed: !!existingBadge,
    rewardStars: SETUP_REWARD_STARS,
    rewardSpacePoints: SETUP_REWARD_SP,
  };
}

/**
 * Credita as recompensas do Setup Inicial NASA quando a org atinge 100%:
 * - Space Points (100 SP)
 * - Stars (50 STARs)
 * - Selo "Organização Pronta" (idempotente via @@unique([userId, badgeId]))
 *
 * Re-checa progresso server-side antes de creditar (não confia no client).
 */
export async function awardSetupRewards(opts: {
  userId: string;
  orgId: string;
}): Promise<{
  starsAwarded: number;
  spAwarded: number;
  badge: { id: string; name: string; iconUrl: string | null; color: string | null } | null;
  alreadyClaimed: boolean;
}> {
  const { userId, orgId } = opts;

  const progress = await computeSetupProgress({ userId, orgId });
  if (!progress.isFullyCompleted) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Setup ainda não está 100% completo",
    });
  }
  if (progress.rewardClaimed) {
    return { starsAwarded: 0, spAwarded: 0, badge: null, alreadyClaimed: true };
  }

  const badge = await prisma.spaceHelpBadge.findUnique({
    where: { slug: SETUP_BADGE_SLUG },
  });

  // 1) Space Points
  let spAwarded = 0;
  if (SETUP_REWARD_SP > 0) {
    const userPoint = await prisma.userSpacePoint.upsert({
      where: { userId },
      create: { userId, orgId },
      update: {},
    });
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + mondayOffset);
    thisMonday.setHours(0, 0, 0, 0);
    const isSameWeek = userPoint.weekStart && userPoint.weekStart >= thisMonday;
    const newWeekly = (isSameWeek ? userPoint.weeklyPoints : 0) + SETUP_REWARD_SP;
    const newTotal = userPoint.totalPoints + SETUP_REWARD_SP;

    await prisma.$transaction([
      prisma.spacePointTransaction.create({
        data: {
          userPointId: userPoint.id,
          points: SETUP_REWARD_SP,
          description: "Setup Inicial NASA — 100% concluído",
          metadata: { source: "spacehelp-setup" } as any,
        },
      }),
      prisma.userSpacePoint.update({
        where: { id: userPoint.id },
        data: {
          totalPoints: newTotal,
          weeklyPoints: newWeekly,
          weekStart: isSameWeek ? userPoint.weekStart : thisMonday,
        },
      }),
    ]);
    spAwarded = SETUP_REWARD_SP;
  }

  // 2) Stars
  let starsAwarded = 0;
  if (SETUP_REWARD_STARS > 0) {
    const orgRow = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { starsBalance: true },
    });
    if (orgRow) {
      const newBalance = orgRow.starsBalance + SETUP_REWARD_STARS;
      await prisma.$transaction([
        prisma.organization.update({
          where: { id: orgId },
          data: { starsBalance: newBalance },
        }),
        prisma.starTransaction.create({
          data: {
            organizationId: orgId,
            type: StarTransactionType.MANUAL_ADJUST,
            amount: SETUP_REWARD_STARS,
            balanceAfter: newBalance,
            description: "Setup Inicial NASA — 100% concluído",
            appSlug: "spacehelp",
          },
        }),
      ]);
      starsAwarded = SETUP_REWARD_STARS;
    }
  }

  // 3) Selo "Organização Pronta"
  let awardedBadge: { id: string; name: string; iconUrl: string | null; color: string | null } | null = null;
  if (badge) {
    await prisma.userSpaceHelpBadge.create({
      data: { userId, badgeId: badge.id },
    });
    awardedBadge = {
      id: badge.id,
      name: badge.name,
      iconUrl: badge.iconUrl,
      color: badge.color,
    };
  }

  // 4) Pusher (popup celebratório)
  try {
    await pusherServer.trigger(`private-user-${userId}`, "spacehelp:setup-completed", {
      starsAwarded,
      spAwarded,
      badge: awardedBadge,
    });
  } catch (err) {
    console.error("[space-help/awardSetupRewards] pusher error:", err);
  }

  return { starsAwarded, spAwarded, badge: awardedBadge, alreadyClaimed: false };
}
