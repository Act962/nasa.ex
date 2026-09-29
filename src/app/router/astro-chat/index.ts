import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { generatePublicKey } from "@/features/astro-chat/lib/keys";
import { normalizeOrigin } from "@/features/astro-chat/lib/origins";
import { PAUSED_REASON } from "@/features/astro-chat/lib/constants";
import { chargeSiteMonthly, getAstroChatMonthlyPrice } from "@/features/astro-chat/server/billing";

/** ASTRO CHAT (spec 0031): sites com o widget, instalação e mensalidade. */

const orgProcedure = base.use(requiredAuthMiddleware).use(requireOrgMiddleware);

const MANAGER_ROLES = new Set(["owner", "admin"]);

type OrgContext = {
  user: { id: string };
  org: { id: string; members: { userId: string; role: string }[] };
};

function assertCanManage(context: OrgContext) {
  const member = context.org.members.find((orgMember) => orgMember.userId === context.user.id);
  const roles = (member?.role ?? "").split(",").map((role) => role.trim());
  if (!roles.some((role) => MANAGER_ROLES.has(role))) {
    throw new ORPCError("FORBIDDEN", { message: "Só donos e admins configuram o ASTRO CHAT." });
  }
}

const siteSelect = {
  id: true,
  name: true,
  publicKey: true,
  allowedOrigins: true,
  trackingId: true,
  statusId: true,
  isEnabled: true,
  pausedReason: true,
  aiEnabled: true,
  assistantName: true,
  greeting: true,
  instructions: true,
  knowledgeIds: true,
  accentColor: true,
  avatarUrl: true,
  widgetTheme: true,
  blockedTopicIds: true,
  restrictionNotes: true,
  position: true,
  privacyUrl: true,
  dailyAiReplyLimit: true,
  aiRepliesDay: true,
  aiRepliesCount: true,
  nextBillingAt: true,
  lastBilledAt: true,
  createdAt: true,
  tracking: { select: { id: true, name: true } },
  _count: { select: { visitors: true } },
} as const;

function normalizeOrigins(rawOrigins: string[]): string[] {
  const normalized = rawOrigins
    .map(normalizeOrigin)
    .filter((origin): origin is string => !!origin);
  return Array.from(new Set(normalized));
}

async function findOwnedSite(organizationId: string, siteId: string) {
  const site = await prisma.astroChatSite.findFirst({
    where: { id: siteId, organizationId },
    select: { id: true, nextBillingAt: true, pausedReason: true, trackingId: true },
  });
  if (!site) throw new ORPCError("NOT_FOUND", { message: "Site não encontrado." });
  return site;
}

async function assertTrackingInOrg(organizationId: string, trackingId: string, statusId?: string | null) {
  const tracking = await prisma.tracking.findFirst({
    where: { id: trackingId, organizationId },
    select: { id: true },
  });
  if (!tracking) throw new ORPCError("BAD_REQUEST", { message: "Tracking inválido." });
  if (statusId) {
    const status = await prisma.status.findFirst({
      where: { id: statusId, trackingId },
      select: { id: true },
    });
    if (!status) throw new ORPCError("BAD_REQUEST", { message: "Etapa inválida para este tracking." });
  }
}

const siteSettingsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  allowedOrigins: z.array(z.string().max(200)).max(10),
  trackingId: z.string(),
  statusId: z.string().nullable().optional(),
  aiEnabled: z.boolean(),
  assistantName: z.string().trim().min(2).max(40),
  greeting: z.string().trim().min(2).max(200),
  instructions: z.string().max(6000).nullable().optional(),
  knowledgeIds: z.array(z.string()).max(20),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  avatarUrl: z.string().url().max(500).nullable().optional(),
  widgetTheme: z.enum(["light", "dark"]),
  blockedTopicIds: z.array(z.string().max(40)).max(30),
  restrictionNotes: z.string().max(2000).nullable().optional(),
  position: z.enum(["right", "left"]),
  privacyUrl: z.string().url().max(300).nullable().optional(),
  dailyAiReplyLimit: z.number().int().min(10).max(5000),
});

const listSites = orgProcedure.handler(async ({ context }) => {
  const [sites, monthlyPrice] = await Promise.all([
    prisma.astroChatSite.findMany({
      where: { organizationId: context.org.id },
      orderBy: { createdAt: "asc" },
      select: siteSelect,
    }),
    getAstroChatMonthlyPrice(),
  ]);
  return { sites, monthlyPrice };
});

const getSite = orgProcedure
  .input(z.object({ siteId: z.string() }))
  .handler(async ({ context, input }) => {
    const site = await prisma.astroChatSite.findFirst({
      where: { id: input.siteId, organizationId: context.org.id },
      select: siteSelect,
    });
    if (!site) throw new ORPCError("NOT_FOUND", { message: "Site não encontrado." });
    return site;
  });

const createSite = orgProcedure
  .input(siteSettingsSchema)
  .handler(async ({ context, input }) => {
    assertCanManage(context);
    await assertTrackingInOrg(context.org.id, input.trackingId, input.statusId);
    const site = await prisma.astroChatSite.create({
      data: {
        ...input,
        allowedOrigins: normalizeOrigins(input.allowedOrigins),
        statusId: input.statusId ?? null,
        instructions: input.instructions ?? null,
        privacyUrl: input.privacyUrl ?? null,
        avatarUrl: input.avatarUrl ?? null,
        restrictionNotes: input.restrictionNotes ?? null,
        organizationId: context.org.id,
        publicKey: generatePublicKey(),
        createdById: context.user.id,
      },
      select: { id: true },
    });
    // Ativação cobra o primeiro mês (D-5). Sem saldo, o site nasce pausado.
    const charge = await chargeSiteMonthly(site.id);
    return { id: site.id, isCharged: charge.isCharged, price: charge.price };
  });

const updateSite = orgProcedure
  .input(siteSettingsSchema.partial().extend({ siteId: z.string(), isEnabled: z.boolean().optional() }))
  .handler(async ({ context, input }) => {
    assertCanManage(context);
    const { siteId, ...changes } = input;
    const site = await findOwnedSite(context.org.id, siteId);
    const nextTrackingId = changes.trackingId ?? site.trackingId;
    if (changes.trackingId || changes.statusId) {
      if (!nextTrackingId) throw new ORPCError("BAD_REQUEST", { message: "Escolha um tracking." });
      await assertTrackingInOrg(context.org.id, nextTrackingId, changes.statusId);
    }
    await prisma.astroChatSite.update({
      where: { id: site.id },
      data: {
        ...changes,
        ...(changes.allowedOrigins ? { allowedOrigins: normalizeOrigins(changes.allowedOrigins) } : {}),
        ...(changes.trackingId && site.pausedReason === PAUSED_REASON.trackingMissing
          ? { pausedReason: null }
          : {}),
      },
    });
    return { id: site.id };
  });

const deleteSite = orgProcedure
  .input(z.object({ siteId: z.string() }))
  .handler(async ({ context, input }) => {
    assertCanManage(context);
    const site = await findOwnedSite(context.org.id, input.siteId);
    await prisma.astroChatSite.delete({ where: { id: site.id } });
    return { id: site.id };
  });

const rotateKey = orgProcedure
  .input(z.object({ siteId: z.string() }))
  .handler(async ({ context, input }) => {
    assertCanManage(context);
    const site = await findOwnedSite(context.org.id, input.siteId);
    return prisma.astroChatSite.update({
      where: { id: site.id },
      data: { publicKey: generatePublicKey() },
      select: { publicKey: true },
    });
  });

/** Reativa um site pausado por falta de Stars cobrando o período (CA-8). */
const reactivateSite = orgProcedure
  .input(z.object({ siteId: z.string() }))
  .handler(async ({ context, input }) => {
    assertCanManage(context);
    const site = await findOwnedSite(context.org.id, input.siteId);
    if (site.pausedReason !== PAUSED_REASON.noStars) return { isCharged: true, price: 0 };
    const charge = await chargeSiteMonthly(site.id);
    if (!charge.isCharged) {
      throw new ORPCError("PRECONDITION_FAILED", {
        message: `Saldo insuficiente: a mensalidade é de ${charge.price} Stars. Recarregue e tente de novo.`,
      });
    }
    return charge;
  });

const listSetupOptions = orgProcedure.handler(async ({ context }) => {
  const [trackings, knowledgeBases] = await Promise.all([
    prisma.tracking.findMany({
      where: { organizationId: context.org.id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        status: { orderBy: { order: "asc" }, select: { id: true, name: true } },
      },
    }),
    prisma.aiKnowledge.findMany({
      where: { organizationId: context.org.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true },
    }),
  ]);
  return { trackings, knowledgeBases };
});

export const astroChatRouter = {
  sites: {
    list: listSites,
    get: getSite,
    create: createSite,
    update: updateSite,
    delete: deleteSite,
    rotateKey,
    reactivate: reactivateSite,
  },
  setupOptions: listSetupOptions,
};
