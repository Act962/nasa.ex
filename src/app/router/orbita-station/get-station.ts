import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { getUserPermissionsForApps } from "@/features/permissions/server/app-permission";
import { ROOM_APP_KEYS } from "@/features/orbita-station/layout/room-kinds";
import { avatarLookSchema } from "@/features/orbita-station/lib/avatar-look";
import { parseStationSettings } from "@/features/orbita-station/lib/station-settings";
import prisma from "@/lib/prisma";

const isUniqueViolation = (error: unknown) => (error as { code?: string } | null)?.code === "P2002";

/** Lê a estação da empresa ativa, criando-a no primeiro acesso (spec 0119, RF-1). Devolve também o avatar da pessoa e os módulos que ela vê. */
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

    const [user, permissions] = await Promise.all([
      prisma.user.findUnique({ where: { id: context.user.id }, select: { orbitaAvatar: true } }),
      getUserPermissionsForApps(organizationId, context.user.id, ["orbita-station", ...ROOM_APP_KEYS]),
    ]);
    const avatar = avatarLookSchema.safeParse(user?.orbitaAvatar);
    // Quais módulos a pessoa pode ver: decide as portas trancadas e os atalhos das salas (spec 0120, RF-2).
    const appAccess = Object.fromEntries(ROOM_APP_KEYS.map((appKey) => [appKey, permissions?.[appKey]?.canView ?? false]));

    return {
      station: parseStationSettings(station),
      // Avatar inválido no banco (formato antigo) vira null: o cliente usa o visual padrão (CB-8).
      avatar: avatar.success ? avatar.data : null,
      canEdit: permissions?.["orbita-station"]?.canEdit ?? false,
      appAccess,
    };
  });
