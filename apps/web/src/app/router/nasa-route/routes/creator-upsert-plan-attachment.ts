import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { requireCourseManager } from "../utils";

export const creatorUpsertPlanAttachment = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string().optional(),
      planId: z.string().min(1),
      kind: z.enum(["pdf", "link"]),
      title: z.string().min(1).max(180),
      description: z.string().max(500).optional().nullable(),
      url: z.string().min(1).optional().nullable(),
      fileKey: z.string().min(1).optional().nullable(),
      fileSize: z.number().int().min(0).optional().nullable(),
      order: z.number().int().min(0).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const plan = await prisma.nasaRoutePlan.findUnique({
      where: { id: input.planId },
      select: { courseId: true },
    });
    if (!plan) throw new ORPCError("NOT_FOUND", { message: "Plano não encontrado" });

    await requireCourseManager(context.user.id, plan.courseId);

    if (input.kind === "link" && !input.url) {
      throw new ORPCError("BAD_REQUEST", { message: "URL é obrigatória para links externos." });
    }
    if (input.kind === "pdf" && !input.fileKey) {
      throw new ORPCError("BAD_REQUEST", { message: "Faça upload do arquivo PDF antes de salvar." });
    }

    if (input.id) {
      const existing = await prisma.nasaRoutePlanAttachment.findUnique({
        where: { id: input.id },
        select: { planId: true },
      });
      if (!existing || existing.planId !== input.planId) {
        throw new ORPCError("NOT_FOUND", { message: "Anexo não encontrado" });
      }

      const updated = await prisma.nasaRoutePlanAttachment.update({
        where: { id: input.id },
        data: {
          kind: input.kind,
          title: input.title,
          description: input.description ?? null,
          url: input.kind === "link" ? input.url ?? null : null,
          fileKey: input.kind === "pdf" ? input.fileKey ?? null : null,
          fileSize: input.kind === "pdf" ? input.fileSize ?? null : null,
          ...(input.order !== undefined ? { order: input.order } : {}),
        },
      });
      return { attachment: updated };
    }

    const order =
      input.order ??
      (await prisma.nasaRoutePlanAttachment.count({ where: { planId: input.planId } }));

    const created = await prisma.nasaRoutePlanAttachment.create({
      data: {
        planId: input.planId,
        kind: input.kind,
        title: input.title,
        description: input.description ?? null,
        url: input.kind === "link" ? input.url ?? null : null,
        fileKey: input.kind === "pdf" ? input.fileKey ?? null : null,
        fileSize: input.kind === "pdf" ? input.fileSize ?? null : null,
        order,
      },
    });
    return { attachment: created };
  });
