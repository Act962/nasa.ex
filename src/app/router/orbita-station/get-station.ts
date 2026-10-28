import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { hasAppPermission } from "@/features/permissions/server/app-permission";
import { avatarLookSchema } from "@/features/orbita-station/lib/avatar-look";
import { parseStationSettings } from "@/features/orbita-station/lib/station-settings";
import prisma from "@/lib/prisma";

const isUniqueViolation = (error: unknown) => (error as { code?: string } | null)?.code === "P2002";

/** Lê a estação da empresa ativa, criando-a no primeiro acesso (spec 0119, RF-1). Devolve também o avatar da pessoa. */
export const getStation = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", path: "/orbita-station", summary: "Estação 3D da empresa ativa e o avatar do usuário" })
  .handler(async ({ context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.FORBIDDEN({ message: "Escolha uma empresa para entrar na estação." });

    let station = await prisma.orbitaStation.findUnique({ where: { organizationId } });
    if (!station) {
      try {
        station = await prisma.orbitaStation.create({ data: { organizationId } });
      } catch (error) {
        // Dois membros abrindo a estação pela primeira vez ao mesmo tempo (CB-1): o segundo lê a do primeiro.
        if (!isUniqueViolation(error)) throw error;
        station = await prisma.orbitaStation.findUniqueOrThrow({ where: { organizationId } });
      }
    }

    const [user, canEdit] = await Promise.all([
      prisma.user.findUnique({ where: { id: context.user.id }, select: { orbitaAvatar: true } }),
      hasAppPermission(organizationId, context.user.id, "orbita-station", "canEdit"),
    ]);
    const avatar = avatarLookSchema.safeParse(user?.orbitaAvatar);

    return {
      station: parseStationSettings(station),
      // Avatar inválido no banco (formato antigo) vira null: o cliente usa o visual padrão (CB-8).
      avatar: avatar.success ? avatar.data : null,
      canEdit,
    };
  });
