/**
 * Popula o `SpaceStationWorld` da station `astronasa` com um mapData
 * explícito (scenario=station, salas+elementos default), assim o
 * engine Phaser desenha a estação imediatamente — sem depender dos
 * defaults internos que aparentemente não estão chutando o `drawStation`.
 *
 * Uso: npx tsx scripts/seed-astronasa-world.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const NICK = "astronasa";

const mapData = {
  scenario: "station",
  gameView: "aerial",
  meetingRoomCount: 2,
  elements: {
    deskType: "standard",
    showMeetingRooms: true,
    showCafeteria: true,
    showPlants: true,
    showCabinets: true,
    chairType: "office",
    showGrass: true,
    showTrees: true,
    showFlowers: true,
  },
  rooms: [
    { type: "copa",        enabled: true },
    { type: "cozinha",     enabled: false },
    { type: "atendimento", enabled: false },
    { type: "coworking",   enabled: true },
    { type: "reuniao",     enabled: true },
    { type: "recepcao",    enabled: true },
  ],
};

(async () => {
  const station = await prisma.spaceStation.findUnique({
    where: { nick: NICK },
    select: { id: true, nick: true, worldConfig: { select: { id: true, mapData: true } } },
  });
  if (!station) {
    console.error(`Station '${NICK}' não encontrada`);
    process.exit(1);
  }

  console.log("station:", { id: station.id, nick: station.nick, hadWorldConfig: !!station.worldConfig, hadMapData: !!station.worldConfig?.mapData });

  const upserted = await prisma.spaceStationWorld.upsert({
    where: { stationId: station.id },
    create: {
      stationId: station.id,
      mapData,
      planetColor: "#4B0082",
      ambientTheme: "space",
    },
    update: { mapData },
    select: { id: true, stationId: true, planetColor: true, ambientTheme: true, mapData: true },
  });

  console.log("worldConfig após upsert:", {
    id: upserted.id,
    planetColor: upserted.planetColor,
    ambientTheme: upserted.ambientTheme,
    scenario: (upserted.mapData as { scenario?: string } | null)?.scenario,
    rooms: ((upserted.mapData as { rooms?: unknown[] } | null)?.rooms ?? []).length,
  });

  await prisma.$disconnect();
})();
