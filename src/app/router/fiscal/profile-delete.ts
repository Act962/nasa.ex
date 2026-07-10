import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { NfeError } from "nfe-io";
import { FocusNfeHttpError } from "@/http/focus-nfe/client";
import { resolveGateway } from "@/features/fiscal/lib/gateways";

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
      });

      if (!profile)
        throw errors.NOT_FOUND({ message: "Perfil fiscal não encontrado" });

      await resolveGateway(profile.fiscalGateway).deleteCompany(profile);

      await prisma.fiscalCompanyProfile.delete({
        where: { organizationId: context.org.id },
      });

      return { ok: true };
    } catch (err) {
      if (err instanceof Error && err.name === "ORPCError") throw err;
      if (err instanceof FocusNfeHttpError) {
        throw errors.BAD_REQUEST({
          message: `Erro ao deletar empresa na Focus: ${err.message}`,
        });
      }
      if (err instanceof NfeError) {
        throw errors.BAD_REQUEST({
          message: `Erro ao deletar empresa na NFE.io: ${err.message}`,
        });
      }
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
