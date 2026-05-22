import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { computeSlaDeadline } from "@/features/leads/lib/sla";

export const updateStatus = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PUT",
    summary: "Update a status",
    tags: ["Status"],
  })
  .input(
    z.object({
      // Todos opcionais — permite update parcial (só nome, só cor, só sla).
      name: z.string().optional(),
      color: z.string().optional(),
      // `slaHours` em horas. `null` limpa o SLA do status (deixa de mostrar
      // timer no card). `undefined` = não mexer no campo. Validamos
      // 1..8760 (1h até 365 dias) pra evitar lixo.
      slaHours: z.number().int().min(1).max(8760).nullable().optional(),
      statusId: z.string(),
    }),
  )
  .output(
    z.object({
      trackingId: z.string(),
      statusName: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const statusExists = await prisma.status.findUnique({
      where: { id: input.statusId },
    });

    if (!statusExists) {
      throw errors.NOT_FOUND;
    }

    // Spread condicional pra cada campo — `undefined` não sobrescreve. Isso
    // permite chamar com só `{ statusId, slaHours: 24 }` sem zerar nome/cor.
    const status = await prisma.status.update({
      where: { id: input.statusId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.slaHours !== undefined ? { slaHours: input.slaHours } : {}),
      },
    });

    // Recalcular `slaDeadline` dos leads que estão NESTE status quando o
    // `slaHours` foi alterado. Sem isso, leads antigos manteriam o deadline
    // calculado com a regra antiga (ou null). Síncrono — escala bem até
    // alguns milhares de leads por status. Se virar gargalo, refatorar pra
    // Inngest fan-out.
    if (input.slaHours !== undefined) {
      const leads = await prisma.lead.findMany({
        where: {
          statusId: input.statusId,
          currentAction: "ACTIVE",
        },
        select: {
          id: true,
          statusEnteredAt: true,
          createdAt: true,
        },
      });

      if (input.slaHours === null) {
        // Limpar SLA: zera o deadline de todos os leads do status.
        await prisma.lead.updateMany({
          where: { statusId: input.statusId, currentAction: "ACTIVE" },
          data: { slaDeadline: null },
        });
      } else {
        // Cada lead pode ter `statusEnteredAt` diferente (entrou em momentos
        // distintos no status), então recalculamos individualmente.
        // `Promise.all` paraleliza no client Prisma — pool gerencia.
        const updates = leads.map((lead) => {
          const deadline = computeSlaDeadline(
            { slaHours: input.slaHours },
            lead.statusEnteredAt ?? lead.createdAt,
          );
          return prisma.lead.update({
            where: { id: lead.id },
            data: { slaDeadline: deadline },
          });
        });
        await Promise.all(updates);
      }
    }

    return {
      trackingId: status.trackingId,
      statusName: status.name,
    };
  });
