import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireAppPermission } from "@/app/middlewares/app-permission";
import prisma from "@/lib/prisma";
import { toApproverPhone } from "@/features/nerp-catalog/lib/approvals/order-approvals";
import { salesRoundSchema, salesSectorSchema } from "./shared";

export const saveSalesApprover = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAppPermission("catalogo-online", "canEdit"))
  .input(
    z.object({
      userId: z.string().min(1),
      sector: salesSectorSchema,
      rounds: z.array(salesRoundSchema).min(1),
      phone: z.string().min(10).max(20),
      // A Meta exige o aceite de quem recebe mensagem iniciada pela empresa (spec 0104, seção 10).
      hasOptIn: z.boolean(),
      isActive: z.boolean().default(true),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.member.findFirst({ where: { organizationId: context.org.id, userId: input.userId }, select: { id: true } });
    if (!member) throw errors.BAD_REQUEST({ message: "Essa pessoa não é membro da empresa." });
    const phoneE164 = toApproverPhone(input.phone);
    if (phoneE164.length < 12) throw errors.BAD_REQUEST({ message: "Informe o WhatsApp com DDD." });

    const existing = await prisma.salesApprover.findUnique({
      where: { organizationId_userId_sector: { organizationId: context.org.id, userId: input.userId, sector: input.sector } },
      select: { optInAt: true },
    });
    const optInAt = input.hasOptIn ? (existing?.optInAt ?? new Date()) : null;
    const saved = await prisma.salesApprover.upsert({
      where: { organizationId_userId_sector: { organizationId: context.org.id, userId: input.userId, sector: input.sector } },
      create: { organizationId: context.org.id, userId: input.userId, sector: input.sector, rounds: input.rounds, phoneE164, optInAt, isActive: input.isActive },
      update: { rounds: input.rounds, phoneE164, optInAt, isActive: input.isActive },
      select: { id: true },
    });
    return { id: saved.id };
  });
