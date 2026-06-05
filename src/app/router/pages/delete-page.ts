import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Exclui uma NasaPage permanentemente (hard delete).
 * Cascade: NasaPageVersion, NasaPageAsset, NasaPageVisit,
 * NasaPageDomainPurchase. Por isso bloqueamos delete quando a page
 * tem domínio comprado em status "ACTIVE" — evita perda silenciosa
 * de domínio pago.
 *
 * Loga atividade ("nasa_pages.deleted_*") pra audit trail. Permite
 * tracking de quem apagou drafts vs publicados.
 */
export const deletePage = base
  .use(requiredAuthMiddleware)
  .route({
    method: "DELETE",
    path: "/pages/:id",
    summary: "Excluir página (hard delete, cascade em versions/assets/visits/domain)",
  })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.BAD_REQUEST({ message: "Organização não encontrada" });
    }
    const existing = await prisma.nasaPage.findFirst({
      where: { id: input.id, organizationId },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        domainPurchase: { select: { status: true, requestedDomain: true } },
      },
    });
    if (!existing) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    // Bloqueia delete se houver domínio comprado ainda ativo.
    if (existing.domainPurchase?.status === "ACTIVE") {
      throw errors.BAD_REQUEST({
        message: `Esta page tem o domínio "${existing.domainPurchase.requestedDomain}" comprado e ativo. Cancele o domínio antes de excluir.`,
      });
    }

    await prisma.nasaPage.delete({ where: { id: input.id } });

    // Loga atividade — visível em Insights → Atividade.
    // Falha silenciosa: se logActivity quebrar, o delete não rola
    // back. Activity log é best-effort.
    try {
      await logActivity({
        organizationId,
        userId: context.session.userId,
        userName: context.session.userName ?? "Usuário",
        userEmail: context.session.userEmail ?? "",
        userImage: undefined,
        appSlug: "nasa-pages",
        action:
          existing.status === "PUBLISHED"
            ? "nasa_pages.deleted_published"
            : "nasa_pages.deleted_draft",
        actionLabel:
          existing.status === "PUBLISHED"
            ? `Apagou page publicada "${existing.title}"`
            : `Apagou rascunho "${existing.title}"`,
        resource: existing.title,
        resourceId: existing.id,
        metadata: {
          slug: existing.slug,
          wasPublished: existing.status === "PUBLISHED",
        },
      });
    } catch (err) {
      console.warn("[delete-page] activity log failed", err);
    }

    return { success: true };
  });
