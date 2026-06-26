import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { deletarEmpresa } from "@/http/focus-nfe/deletar-empresa";
import { FocusNfeHttpError } from "@/http/focus-nfe/client";

export const fiscalProfileDelete = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Delete fiscal profile", tags: ["Fiscal"] })
  .input(z.object({}))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ context, errors }) => {
    try {
      const profile = await prisma.fiscalCompanyProfile.findUnique({
        where: { organizationId: context.org.id },
        select: { focusEmpresaId: true },
      });

      if (!profile) throw errors.NOT_FOUND({ message: "Perfil fiscal não encontrado" });

      if (profile.focusEmpresaId !== null) {
        try {
          await deletarEmpresa(profile.focusEmpresaId);
        } catch (err) {
          // 404 significa que a empresa já não existe na Focus — prossegue com a limpeza local
          if (!(err instanceof FocusNfeHttpError && err.status === 404)) throw err;
        }
      }

      await prisma.fiscalCompanyProfile.delete({
        where: { organizationId: context.org.id },
      });

      return { ok: true };
    } catch (err) {
      if (err instanceof FocusNfeHttpError) {
        throw errors.BAD_REQUEST({
          message: `Erro ao deletar empresa na Focus: ${err.message}`,
        });
      }
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
