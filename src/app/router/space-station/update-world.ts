import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { pusherServer } from "@/lib/pusher";
import z from "zod";

const avatarConfigSchema = z.object({
  suitColor: z.string().optional(),
  helmetColor: z.string().optional(),
  accessory: z.enum(["none", "flag", "jetpack"]).optional(),
  skinTone: z.string().optional(),
  useProfilePhoto: z.boolean().optional(),
  hairStyle: z.enum(["none", "short", "long", "curly", "afro", "ponytail"]).optional(),
  hairColor: z.string().optional(),
  beardStyle: z.enum(["none", "stubble", "short", "full"]).optional(),
  faceAccessory: z.enum(["none", "glasses", "sunglasses"]).optional(),
  lpcSpritesheetUrl: z.union([
    z.string().url(),                      // URLs absolutas (ex: CDN externo)
    z.literal("pixel_astronaut"),          // legado
    z.string().startsWith("/woka/"),       // spritesheets Pipoya locais
    z.string().startsWith("/uploads/"),    // sprites customizados enviados via upload
  ]).optional().nullable(),
  lpcCharacterName: z.string().max(60).optional().nullable(),
  // WokaCustomizer overlay URLs (LPC assets). Accept any http(s) URL so we
  // can reference WorkAdventure's CDN, the LimeZu mirror, or self-hosted files.
  wokaEyesUrl:      z.string().url().optional().nullable(),
  wokaHairUrl:      z.string().url().optional().nullable(),
  wokaClothesUrl:   z.string().url().optional().nullable(),
  wokaHatUrl:       z.string().url().optional().nullable(),
  wokaAccessoryUrl: z.string().url().optional().nullable(),
  // Multiplicador do tamanho visual do avatar no mapa
  avatarScale:      z.number().min(0.5).max(2.5).optional().nullable(),
});

export const updateWorld = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PUT",
    path: "/space-station/:stationId/world",
    summary: "Create or update the Space Station world config",
  })
  .input(
    z.object({
      stationId: z.string(),
      planetColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      ambientTheme: z.string().optional(),
      avatarConfig: avatarConfigSchema.optional(),
      meetingPoints: z.array(z.object({ x: z.number(), y: z.number(), label: z.string() })).optional(),
      npcConfig: z.unknown().optional(),
      mapData: z.unknown().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { stationId, planetColor, ambientTheme, avatarConfig, meetingPoints, npcConfig, mapData } = input;
    const orgId = context.session.activeOrganizationId;
    const userId = context.user.id;

    const station = await prisma.spaceStation.findUnique({ where: { id: stationId } });
    if (!station) throw errors.NOT_FOUND({ message: "Space Station não encontrada" });

    const isOwner =
      (station.type === "USER" && station.userId === userId) ||
      (station.type === "ORG" && (station.orgId === orgId || station.userId === userId));

    if (!isOwner) throw errors.FORBIDDEN({ message: "Sem permissão para configurar esta station" });

    const data: Prisma.SpaceStationWorldUpdateInput = {};
    if (planetColor !== undefined) data.planetColor = planetColor;
    if (ambientTheme !== undefined) data.ambientTheme = ambientTheme;
    if (avatarConfig !== undefined) data.avatarConfig = avatarConfig as Prisma.InputJsonValue;
    if (meetingPoints !== undefined) data.meetingPoints = meetingPoints as Prisma.InputJsonValue;
    if (npcConfig !== undefined) data.npcConfig = npcConfig as Prisma.InputJsonValue;
    if (mapData !== undefined) data.mapData = mapData as Prisma.InputJsonValue;

    try {
      const world = await prisma.spaceStationWorld.upsert({
        where: { stationId },
        create: { stationId, ...data } as Prisma.SpaceStationWorldUncheckedCreateInput,
        update: data,
      });

      // Broadcast mudança pros outros clients conectados no mesmo channel
      // da presença. Cada client ouve `world:config-updated` e re-renderiza
      // a página (router.refresh()) pra puxar o worldConfig fresco do banco.
      // `savedBy` permite o cliente que SALVOU ignorar o próprio event e
      // evitar refresh redundante. Os campos atualizados vão no payload
      // pra debug, mas o client confia só no banco depois do refresh.
      const changedFields = (Object.keys(data) as Array<keyof typeof data>).filter(
        (k) => data[k] !== undefined,
      );
      await pusherServer
        .trigger(`presence-world-${stationId}`, "world:config-updated", {
          savedBy: userId,
          savedAt: new Date().toISOString(),
          changedFields,
        })
        .catch((pusherErr) => {
          // Best-effort: se Pusher falhar (key inválida, network), o save
          // já foi feito. Próxima vez que outro user der F5 vai pegar a
          // mudança. Não derrubamos o request por causa disso.
          console.error("[updateWorld] Pusher broadcast falhou:", pusherErr);
        });

      return { world };
    } catch (err) {
      console.error("[updateWorld] Prisma error:", err);
      throw err;
    }
  });
