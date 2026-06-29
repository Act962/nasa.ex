import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { spaceVisibilityGuard } from "./middlewares/visibility-guard";
import { POSITIONS } from "@/features/company/constants";

/**
 * Tripulação pública da empresa — lista membros (`Member`) com foto, nome
 * e cargo (resolvido a partir do slug `cargo` para label + level).
 *
 * Diferente de `getOrgChart` (que requer publicConsent + orgRoles configurados),
 * esta procedure SEMPRE retorna os membros visíveis para que a Spacehome
 * mostre a tripulação mesmo sem organograma configurado.
 *
 * Apenas o nome e a foto pública saem (mesmo critério do PUBLIC_USER_SELECT).
 */

// Lookup map slug → { label, level, group }
const POSITION_BY_SLUG = new Map(POSITIONS.map((p) => [p.slug, p]));

export const getCrew = base
  .use(spaceVisibilityGuard)
  .input(z.object({ nick: z.string().min(1) }))
  .handler(async ({ context }) => {
    const { organization } = context;

    const members = await prisma.member.findMany({
      where: { organizationId: organization.id },
      select: {
        id: true,
        role: true,    // owner | admin | member
        cargo: true,   // slug do cargo (ex: "ceo", "head", "especialista")
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    const crew = members
      .filter((m) => m.user)
      .map((m) => {
        const position = m.cargo ? POSITION_BY_SLUG.get(m.cargo) : undefined;
        // Owner sem cargo definido vira CEO por padrão
        const isOwner = m.role === "owner";
        return {
          memberId:    m.id,
          userId:      m.user!.id,
          displayName: m.user!.name ?? "Sem nome",
          image:       m.user!.image ?? null,
          jobTitle:    position?.label ?? (isOwner ? "CEO" : "Membro"),
          level:       position?.level ?? (isOwner ? 1 : 10),
          // 6 tiers: n1 (fundadores) → n2 (C-level) → n3 (gerência sr.) →
          // gestão → operacional → entrada. Legacy `lideranca` é remapeado
          // pra n1 pra clientes antigos não quebrarem.
          group:       (position?.group === "lideranca" ? "n1" : position?.group)
                         ?? (isOwner ? "n1" : "operacional"),
          role:        m.role,
        };
      })
      // Ordena: liderança primeiro (level 1), entrada por último (level 10)
      .sort((a, b) => a.level - b.level || a.displayName.localeCompare(b.displayName));

    return { crew };
  });
