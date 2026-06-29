import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { orgAdminGuard } from "./middlewares/org-admin-guard";

/**
 * Cria ou atualiza um nó do organograma (OrgRole).
 * - Se `userId` for null ⇒ vaga aberta (fica pública imediatamente).
 * - Se `userId` preenchido ⇒ `publicConsent=false` até o usuário
 *   aceitar explicitamente (§7.1 do plano).
 * - `jobTitleId` vem sempre de JobTitleCatalog (dropdown fixo).
 */
export const upsertRole = base
  .use(orgAdminGuard)
  .input(
    z.object({
      orgId: z.string().min(1),
      roleId: z.string().optional(),
      userId: z.string().nullable().optional(),
      jobTitleId: z.string().min(1),
      customLabel: z.string().max(80).nullable().optional(),
      parentId: z.string().nullable().optional(),
      department: z.string().max(80).nullable().optional(),
      order: z.number().int().min(0).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    // Valida que o jobTitleId existe no catálogo fixo
    const jobTitle = await prisma.jobTitleCatalog.findUnique({
      where: { id: input.jobTitleId },
      select: { id: true },
    });
    if (!jobTitle) {
      throw errors.BAD_REQUEST({ message: "Cargo inválido." });
    }

    const baseData = {
      orgId: context.orgId,
      userId: input.userId ?? null,
      jobTitleId: input.jobTitleId,
      customLabel: input.customLabel ?? null,
      parentId: input.parentId ?? null,
      department: input.department ?? null,
      order: input.order ?? 0,
    };

    if (input.roleId) {
      const existing = await prisma.orgRole.findFirst({
        where: { id: input.roleId, orgId: context.orgId },
        select: { id: true, userId: true },
      });
      if (!existing) throw errors.NOT_FOUND({ message: "Cargo não encontrado." });

      // Se mudou o userId, reinicia o consent
      const userChanged = existing.userId !== (input.userId ?? null);
      const role = await prisma.orgRole.update({
        where: { id: existing.id },
        data: {
          ...baseData,
          ...(userChanged
            ? { publicConsent: false, consentedAt: null }
            : {}),
        },
      });
      return role;
    }

    const role = await prisma.orgRole.create({
      data: {
        ...baseData,
        publicConsent: input.userId ? false : true, // vaga aberta é pública
      },
    });
    return role;
  });
