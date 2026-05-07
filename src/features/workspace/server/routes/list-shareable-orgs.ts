import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

/**
 * Lista todas as organizações onde o user atual é membro (excluindo a org
 * corrente). Cada item traz `canShareDirectly = role in ('owner','admin','moderador')`.
 *
 * Usado pelo multi-select "Compartilhar com empresas" no `CreateActionModal`:
 * - `canShareDirectly: true`  → cópia direta da action ao salvar.
 * - `canShareDirectly: false` → cria `ActionShare` PENDING ("Solicitar acesso").
 */
const ROLES_WITH_SHARE_PERMISSION = ["owner", "admin", "moderador"] as const;

export const listShareableOrgs = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const memberships = await prisma.member.findMany({
      where: {
        userId: context.user.id,
        organizationId: { not: context.org.id },
      },
      select: {
        role: true,
        organization: {
          select: { id: true, name: true, logo: true },
        },
      },
      orderBy: { organization: { name: "asc" } },
    });

    return {
      organizations: memberships
        .filter((m) => m.organization)
        .map((m) => ({
          id: m.organization.id,
          name: m.organization.name,
          logo: m.organization.logo,
          role: m.role,
          canShareDirectly: (
            ROLES_WITH_SHARE_PERMISSION as readonly string[]
          ).includes(m.role),
        })),
    };
  });
