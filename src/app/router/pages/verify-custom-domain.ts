import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { promises as dns } from "node:dns";
import z from "zod";
import { PRIMARY_HOST } from "@/features/pages/lib/domain-utils";

const SERVER_IP = process.env.NEXT_PUBLIC_PAGES_SERVER_IP;

/** TXT `_nasa-verify.<domain>` contém o token gerado no registro. */
async function checkTxt(domain: string, token: string): Promise<boolean> {
  try {
    const records = await dns.resolveTxt(`_nasa-verify.${domain}`);
    return records.some((rows) => rows.join("").trim() === token);
  } catch {
    return false;
  }
}

/**
 * Domínio aponta pra plataforma. Aceita dois formatos:
 *   - apex (`meusite.com`): A-record → `NASA_PAGES_SERVER_IP`.
 *   - `www`/subdomínio: CNAME → host da plataforma.
 * Tenta o domínio e o `www.` em ambos os casos.
 */
async function checkPointing(domain: string): Promise<boolean> {
  if (SERVER_IP) {
    for (const target of [domain, `www.${domain}`]) {
      try {
        const records = await dns.resolve4(target);
        if (records.includes(SERVER_IP)) return true;
      } catch {
        /* sem A-record nesse host — tenta CNAME abaixo */
      }
    }
  }
  for (const target of [domain, `www.${domain}`]) {
    try {
      const records = await dns.resolveCname(target);
      if (records.some((record) => record.toLowerCase().includes(PRIMARY_HOST))) {
        return true;
      }
    } catch {
      /* sem CNAME nesse host */
    }
  }
  return false;
}

export const verifyCustomDomain = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/pages/:id/domain/verify",
    summary: "Verificar TXT + apontamento (A-record apex / CNAME www) do domínio externo",
  })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.BAD_REQUEST({ message: "Organização não encontrada" });
    }
    const page = await prisma.nasaPage.findFirst({
      where: { id: input.id, organizationId },
      select: {
        id: true,
        customDomain: true,
        domainVerifyToken: true,
        domainStatus: true,
      },
    });
    if (!page || !page.customDomain || !page.domainVerifyToken) {
      throw errors.BAD_REQUEST({ message: "Domínio não configurado" });
    }

    // Verificado = TXT (posse) E apontamento (A-record apex OU CNAME www).
    const txtOk = await checkTxt(page.customDomain, page.domainVerifyToken);
    const pointingOk = txtOk ? await checkPointing(page.customDomain) : false;
    const isVerified = txtOk && pointingOk;

    const updated = await prisma.nasaPage.update({
      where: { id: page.id },
      data: { domainStatus: isVerified ? "VERIFIED" : "FAILED" },
      select: { customDomain: true, domainStatus: true },
    });
    return { verified: isVerified, page: updated };
  });
