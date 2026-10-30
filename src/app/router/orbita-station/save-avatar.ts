import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { avatarLookSchema } from "@/features/orbita-station/lib/avatar-look";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";

/**
 * Salva o visual do personagem da própria pessoa (spec 0119, RF-4). É dado pessoal, não da empresa: fica fora da
 * matriz de permissões do app (ver `skipPathSegments` no router) e só grava no usuário da sessão.
 */
export const saveAvatar = base
  .use(requiredAuthMiddleware)
  .route({ method: "PUT", path: "/orbita-station/avatar", summary: "Salva o personagem do usuário na estação 3D" })
  .input(z.object({ look: avatarLookSchema, onlyIfEmpty: z.boolean().default(false) }))
  .handler(async ({ input, context }) => {
    // `onlyIfEmpty`: a migração do avatar da etapa 1 (navegador) não sobrescreve um avatar já salvo no servidor (RF-5).
    const { count } = await prisma.user.updateMany({
      where: { id: context.user.id, ...(input.onlyIfEmpty ? { orbitaAvatar: { equals: Prisma.AnyNull } } : {}) },
      data: { orbitaAvatar: input.look },
    });
    return { isSaved: count > 0 };
  });
