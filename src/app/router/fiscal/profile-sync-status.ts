import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { NfeError } from "nfe-io";
import { resolveGateway } from "@/features/fiscal/lib/gateways";

// Sincroniza o status cadastral da empresa no gateway (habilitação na
// prefeitura + certificado) — a UI usa para exibir "empresa ativa?" e validade.
export const fiscalProfileSyncStatus = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Sync fiscal company status from gateway",
    tags: ["Fiscal"],
  })
  .input(z.object({}))
  .output(
    z.object({
      ok: z.boolean(),
      fiscalStatus: z.string().nullable(),
      certificateStatus: z.string().nullable(),
      certificateExpiresOn: z.string().nullable(),
    }),
  )
  .handler(async ({ context, errors }) => {
    const profile = await prisma.fiscalCompanyProfile.findUnique({
      where: { organizationId: context.org.id },
    });
    if (!profile)
      throw errors.NOT_FOUND({ message: "Perfil fiscal não encontrado" });

    let patch;
    try {
      patch = await resolveGateway(profile.fiscalGateway).getCompanyStatus(
        profile,
      );
    } catch (err) {
      console.error("[fiscal/profile-sync-status] erro no gateway:", err);
      if (err instanceof NfeError) {
        throw errors.BAD_REQUEST({ message: `NFE.io: ${err.message}` });
      }
      throw errors.INTERNAL_SERVER_ERROR;
    }

    const updated = patch
      ? await prisma.fiscalCompanyProfile.update({
          where: { id: profile.id },
          data: patch,
        })
      : profile;

    return {
      ok: true,
      fiscalStatus: updated.nfeIoFiscalStatus,
      certificateStatus: updated.nfeIoCertificateStatus,
      certificateExpiresOn:
        updated.nfeIoCertificateExpiresOn?.toISOString() ?? null,
    };
  });
