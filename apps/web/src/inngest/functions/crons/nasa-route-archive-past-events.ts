/**
 * Cron: nasa-route-archive-past-events
 *
 * Roda 1x por hora — varre `nasa_route_course` que JÁ TERMINARAM mas ainda
 * estão visíveis no listing público (`isArchived = false`) e arquiva.
 *
 * Critério de "terminou":
 *  - `endsAt < now()` (campo unificado, novo)
 *  - OU `eventEndsAt < now()` (campo legacy do format="event") — preservado
 *    pra dados que foram criados antes do refactor
 *
 * Arquivar = `isArchived: true` + `archivedAt: now()`. NÃO deleta o curso
 * do banco — alunos matriculados continuam tendo acesso ao conteúdo
 * gravado (vídeos, materiais). O curso só some da página pública de
 * listagem (filtrado em queries server-side com `isArchived: false`).
 *
 * Cron de hora em hora pra eventos "ao vivo" não ficarem visíveis depois
 * de terminados — UX importante (ninguém quer se inscrever num webinar
 * que rolou ontem).
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";

export const nasaRouteArchivePastEvents = inngest.createFunction(
  { id: "nasa-route-archive-past-events", retries: 1 },
  { cron: "0 * * * *" }, // a cada hora
  async ({ step }) => {
    const now = new Date();

    // Busca cursos com endsAt OU eventEndsAt no passado, ainda não arquivados.
    // OR é necessário durante a transição entre o campo legacy `eventEndsAt`
    // e o unificado `endsAt`.
    const expired = await step.run("find-expired-courses", async () => {
      return prisma.nasaRouteCourse.findMany({
        where: {
          isArchived: false,
          OR: [
            { endsAt: { lt: now, not: null } },
            { eventEndsAt: { lt: now, not: null } },
          ],
        },
        select: {
          id: true,
          title: true,
          format: true,
          endsAt: true,
          eventEndsAt: true,
        },
      });
    });

    if (expired.length === 0) {
      return { archived: 0, scannedAt: now.toISOString() };
    }

    await step.run("archive-courses", async () => {
      await prisma.nasaRouteCourse.updateMany({
        where: {
          id: { in: expired.map((c) => c.id) },
        },
        data: {
          isArchived: true,
          archivedAt: now,
        },
      });
    });

    console.log(
      `[nasa-route-archive-past-events] arquivado ${expired.length} curso(s):`,
      expired.map((c) => ({ id: c.id, title: c.title, format: c.format })),
    );

    return {
      archived: expired.length,
      scannedAt: now.toISOString(),
      courseIds: expired.map((c) => c.id),
    };
  },
);
