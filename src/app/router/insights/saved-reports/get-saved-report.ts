import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

export const getSavedReport = base
  .input(
    z.object({
      id: z.string().optional(),
      shareToken: z.string().optional(),
    }),
  )
  .handler(async ({ input }) => {
    if (!input.id && !input.shareToken) {
      throw new ORPCError("BAD_REQUEST", { message: "id ou shareToken obrigatório" });
    }

    const report = input.shareToken
      ? await prisma.savedInsightReport.findUnique({
          where: { shareToken: input.shareToken },
          include: {
            createdBy: { select: { id: true, name: true, image: true } },
            organization: { select: { id: true, name: true, logo: true } },
          },
        })
      : await prisma.savedInsightReport.findUnique({
          where: { id: input.id! },
          include: {
            createdBy: { select: { id: true, name: true, image: true } },
            organization: { select: { id: true, name: true, logo: true } },
          },
        });

    if (!report) {
      throw new ORPCError("NOT_FOUND", { message: "Relatório não encontrado" });
    }

    return {
      report: {
        id: report.id,
        name: report.name,
        description: report.description,
        filters: report.filters,
        modules: report.modules,
        snapshot: report.snapshot,
        aiNarrative: report.aiNarrative,
        shareToken: report.shareToken,
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.updatedAt.toISOString(),
        author: report.createdBy,
        organization: report.organization,
      },
    };
  });
