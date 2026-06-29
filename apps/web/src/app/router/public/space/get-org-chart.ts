import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import {
  PUBLIC_USER_SELECT,
  PUBLIC_JOB_TITLE_SELECT,
} from "@/features/space-page/utils/public-selectors";
import { spaceVisibilityGuard } from "./middlewares/visibility-guard";

/**
 * Árvore do organograma público de uma empresa.
 *
 * REGRA CRÍTICA (§7.1 do plano):
 *  - Vagas abertas (`userId = null`) aparecem SEMPRE.
 *  - Nós com `userId` só aparecem se `publicConsent = true`.
 *  - Se `showPhoto = false`, `user.image` vem null.
 *  - Se `showName = false`, `user.name` é mascarado ("A. B.").
 *  - Dados sensíveis (email, phone, session) NUNCA saem.
 */
export const getOrgChart = base
  .use(spaceVisibilityGuard)
  .input(z.object({ nick: z.string().min(1) }))
  .handler(async ({ context }) => {
    const { organization } = context;

    const rows = await prisma.orgRole.findMany({
      where: {
        orgId: organization.id,
        OR: [{ userId: null }, { publicConsent: true }],
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        parentId: true,
        department: true,
        customLabel: true,
        order: true,
        showPhoto: true,
        showName: true,
        publicConsent: true,
        user: { select: PUBLIC_USER_SELECT },
        jobTitle: { select: PUBLIC_JOB_TITLE_SELECT },
      },
    });

    // Sanitiza cada nó respeitando os toggles
    const nodes = rows.map((r) => {
      const user = r.user;
      let displayName: string | null = null;
      let image: string | null = null;

      if (user) {
        if (r.showName) {
          displayName = user.name;
        } else if (user.name) {
          // só iniciais
          displayName = user.name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((s) => s[0]?.toUpperCase() ?? "")
            .join(". ");
          displayName = displayName ? `${displayName}.` : null;
        }

        image = r.showPhoto ? (user.image ?? null) : null;
      }

      return {
        id: r.id,
        parentId: r.parentId,
        department: r.department,
        customLabel: r.customLabel,
        jobTitle: r.jobTitle,
        user: user
          ? {
              id: user.id,
              displayName,
              image,
            }
          : null,
        isOpenPosition: !user,
      };
    });

    return { nodes };
  });
