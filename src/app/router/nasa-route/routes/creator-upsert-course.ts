import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { isCourseManager, requireCourseManager } from "../utils";
import {
  COURSE_FORMATS,
  COMMUNITY_TYPES,
  SUBSCRIPTION_PERIODS,
} from "@/features/nasa-route/lib/formats";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const courseInputSchema = z
  .object({
    id: z.string().optional(),
    slug: z
      .string()
      .min(2)
      .max(80)
      .regex(SLUG_RE, "Use apenas letras minúsculas, números e hífens"),
    title: z.string().min(2).max(120),
    subtitle: z.string().max(180).optional().nullable(),
    description: z.string().max(8000).optional().nullable(),
    coverUrl: z.string().min(1).optional().nullable(),
    trailerUrl: z.string().min(1).optional().nullable(),
    level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
    format: z.enum(COURSE_FORMATS).default("course"),
    durationMin: z.number().int().min(0).optional().nullable(),
    priceStars: z.number().int().min(0).default(0),
    categoryId: z.string().optional().nullable(),
    rewardSpOnComplete: z.number().int().min(0).default(0),

    // ── eBook (format = "ebook") ──────────────────────────────
    ebookFileKey: z.string().min(1).optional().nullable(),
    ebookFileName: z.string().max(255).optional().nullable(),
    ebookFileSize: z.number().int().min(0).optional().nullable(),
    ebookMimeType: z.string().max(100).optional().nullable(),
    ebookPageCount: z.number().int().min(0).optional().nullable(),

    // ── Evento Online (format = "event") ──────────────────────
    eventStartsAt: z.coerce.date().optional().nullable(),
    eventEndsAt: z.coerce.date().optional().nullable(),
    eventStreamUrl: z.string().url("URL inválida").optional().nullable(),
    eventTimezone: z.string().max(64).optional().nullable(),
    eventLocationNote: z.string().max(1000).optional().nullable(),

    // ── Comunidade (format = "community") ─────────────────────
    communityType: z.enum(COMMUNITY_TYPES).optional().nullable(),
    communityInviteUrl: z.string().url("URL inválida").optional().nullable(),
    communityRules: z.string().max(4000).optional().nullable(),

    // ── Assinatura (format = "subscription") ──────────────────
    subscriptionPeriod: z.enum(SUBSCRIPTION_PERIODS).optional().nullable(),
  })
  .superRefine((input, ctx) => {
    // Validações condicionais por formato.
    if (input.format === "ebook" && !input.ebookFileKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ebookFileKey"],
        message: "Faça upload do arquivo do eBook (PDF ou EPUB).",
      });
    }
    if (input.format === "event") {
      if (!input.eventStartsAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["eventStartsAt"],
          message: "Data e hora de início do evento são obrigatórias.",
        });
      }
      if (!input.eventStreamUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["eventStreamUrl"],
          message: "Link de transmissão é obrigatório.",
        });
      }
      if (
        input.eventStartsAt &&
        input.eventStartsAt.getTime() < Date.now() + 60 * 60 * 1000
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["eventStartsAt"],
          message: "Evento precisa estar agendado para pelo menos 1 hora no futuro.",
        });
      }
      if (
        input.eventEndsAt &&
        input.eventStartsAt &&
        input.eventEndsAt.getTime() <= input.eventStartsAt.getTime()
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["eventEndsAt"],
          message: "Fim do evento precisa ser depois do início.",
        });
      }
    }
    if (input.format === "community") {
      if (!input.communityType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["communityType"],
          message: "Escolha o tipo da comunidade.",
        });
      }
      if (!input.communityInviteUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["communityInviteUrl"],
          message: "Link de convite é obrigatório.",
        });
      }
    }
    if (input.format === "subscription") {
      if (!input.subscriptionPeriod) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["subscriptionPeriod"],
          message: "Defina a periodicidade da assinatura.",
        });
      }
      // V1: só aceitamos mensal — yearly fica pra V2.
      if (input.subscriptionPeriod && input.subscriptionPeriod !== "monthly") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["subscriptionPeriod"],
          message: "Apenas assinatura mensal está disponível no momento.",
        });
      }
    }
  });

/**
 * Monta o payload pra Prisma com os campos de formato.
 *
 * Para formatos que NÃO usam um campo (ex: course com `eventStartsAt`),
 * grava `null` pra limpar dados antigos caso o criador troque de formato.
 */
function buildFormatFields(input: z.infer<typeof courseInputSchema>) {
  const isEbook = input.format === "ebook";
  const isEvent = input.format === "event";
  const isCommunity = input.format === "community";
  const isSubscription = input.format === "subscription";

  return {
    // eBook
    ebookFileKey: isEbook ? input.ebookFileKey ?? null : null,
    ebookFileName: isEbook ? input.ebookFileName ?? null : null,
    ebookFileSize: isEbook ? input.ebookFileSize ?? null : null,
    ebookMimeType: isEbook ? input.ebookMimeType ?? null : null,
    ebookPageCount: isEbook ? input.ebookPageCount ?? null : null,

    // Evento
    eventStartsAt: isEvent ? input.eventStartsAt ?? null : null,
    eventEndsAt: isEvent ? input.eventEndsAt ?? null : null,
    eventStreamUrl: isEvent ? input.eventStreamUrl ?? null : null,
    eventTimezone: isEvent ? input.eventTimezone ?? null : null,
    eventLocationNote: isEvent ? input.eventLocationNote ?? null : null,

    // Comunidade
    communityType: isCommunity ? input.communityType ?? null : null,
    communityInviteUrl: isCommunity ? input.communityInviteUrl ?? null : null,
    communityRules: isCommunity ? input.communityRules ?? null : null,

    // Assinatura
    subscriptionPeriod: isSubscription ? input.subscriptionPeriod ?? null : null,
  };
}

export const creatorUpsertCourse = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(courseInputSchema)
  .handler(async ({ input, context }) => {
    const userId = context.user.id;
    const orgId = context.org.id;

    // Permissões: precisa ser membro da org criadora (e a org ativa precisa ser a criadora)
    const canCreate = await isCourseManager(userId, orgId);
    if (!canCreate) {
      // Permitir também membros simples a criar curso (qualquer user com org pode ser criador)
      const member = await prisma.member.findFirst({
        where: { organizationId: orgId, userId },
        select: { id: true },
      });
      if (!member) {
        throw new ORPCError("FORBIDDEN", {
          message: "Você precisa ser membro da organização para criar cursos",
        });
      }
    }

    const formatFields = buildFormatFields(input);

    if (input.id) {
      await requireCourseManager(userId, input.id);

      // Bloqueia mudança de formato se já existem matrículas ativas — evita
      // que aluno comprou "curso em vídeo" e descubra que virou "comunidade".
      const existing = await prisma.nasaRouteCourse.findUnique({
        where: { id: input.id },
        select: {
          format: true,
          _count: { select: { enrollments: { where: { status: "active" } } } },
        },
      });
      if (
        existing &&
        existing.format !== input.format &&
        existing._count.enrollments > 0
      ) {
        throw new ORPCError("BAD_REQUEST", {
          message:
            "Não é possível trocar o formato de um produto com matrículas ativas.",
          data: {
            code: "FORMAT_CHANGE_BLOCKED",
            currentFormat: existing.format,
            requestedFormat: input.format,
          },
        });
      }

      const updated = await prisma.nasaRouteCourse.update({
        where: { id: input.id },
        data: {
          slug: input.slug,
          title: input.title,
          subtitle: input.subtitle ?? null,
          description: input.description ?? null,
          coverUrl: input.coverUrl ?? null,
          trailerUrl: input.trailerUrl ?? null,
          level: input.level,
          format: input.format,
          durationMin: input.durationMin ?? null,
          priceStars: input.priceStars,
          categoryId: input.categoryId ?? null,
          rewardSpOnComplete: input.rewardSpOnComplete,
          ...formatFields,
        },
      });
      return { course: updated };
    }

    // Cria curso + plano default no mesmo passo. Plano default herda o preço
    // do curso e ainda não tem aulas (nascem do form de aula).
    const created = await prisma.nasaRouteCourse.create({
      data: {
        creatorOrgId: orgId,
        creatorUserId: userId,
        slug: input.slug,
        title: input.title,
        subtitle: input.subtitle ?? null,
        description: input.description ?? null,
        coverUrl: input.coverUrl ?? null,
        trailerUrl: input.trailerUrl ?? null,
        level: input.level,
        format: input.format,
        durationMin: input.durationMin ?? null,
        priceStars: input.priceStars,
        categoryId: input.categoryId ?? null,
        rewardSpOnComplete: input.rewardSpOnComplete,
        isPublished: false,
        ...formatFields,
        plans: {
          create: {
            name: "Acesso completo",
            description: "Acesso a todas as aulas do curso.",
            priceStars: input.priceStars,
            order: 0,
            isDefault: true,
          },
        },
      },
    });
    return { course: created };
  });
