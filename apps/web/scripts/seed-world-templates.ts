import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Pega o primeiro user como "author" dos templates do sistema
async function getSystemAuthor() {
  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) throw new Error('Nenhum usuário encontrado');
  return user.id;
}

// Templates pré-definidos com mapData simplificado
const TEMPLATES = [
  {
    name: "Escritório Moderno",
    description: "Ambiente corporativo com áreas de trabalho, copa e salas de reunião",
    category: "OFFICE",
    previewUrl: null,
    mapData: {
      scenario: "station",
      gameView: "aerial",
      elements: {
        deskType: "standard", showMeetingRooms: true, showCafeteria: true,
        showPlants: true, showCabinets: true, chairType: "office",
        showGrass: true, showTrees: true, showFlowers: true,
      },
      rooms: [
        { type: "coworking", enabled: true },
        { type: "reuniao", enabled: true },
        { type: "copa", enabled: true },
        { type: "recepcao", enabled: true },
        { type: "atendimento", enabled: false },
        { type: "cozinha", enabled: false },
      ],
      meetingRoomCount: 2,
    },
  },
  {
    name: "Coworking Descontraído",
    description: "Espaço aberto e colaborativo com decoração moderna e plantas",
    category: "OFFICE",
    previewUrl: null,
    mapData: {
      scenario: "station",
      gameView: "aerial",
      elements: {
        deskType: "minimal", showMeetingRooms: false, showCafeteria: true,
        showPlants: true, showCabinets: false, chairType: "office",
        showGrass: true, showTrees: true, showFlowers: true,
      },
      rooms: [
        { type: "coworking", enabled: true },
        { type: "copa", enabled: true },
        { type: "reuniao", enabled: false },
        { type: "recepcao", enabled: false },
        { type: "atendimento", enabled: false },
        { type: "cozinha", enabled: true },
      ],
      meetingRoomCount: 1,
    },
  },
  {
    name: "Centro de Atendimento",
    description: "Layout focado em atendimento ao cliente com recepção e suporte",
    category: "OFFICE",
    previewUrl: null,
    mapData: {
      scenario: "station",
      gameView: "aerial",
      elements: {
        deskType: "standard", showMeetingRooms: false, showCafeteria: true,
        showPlants: true, showCabinets: true, chairType: "office",
        showGrass: false, showTrees: false, showFlowers: false,
      },
      rooms: [
        { type: "recepcao", enabled: true },
        { type: "atendimento", enabled: true },
        { type: "coworking", enabled: true },
        { type: "copa", enabled: true },
        { type: "reuniao", enabled: false },
        { type: "cozinha", enabled: false },
      ],
      meetingRoomCount: 0,
    },
  },
  {
    name: "Base Espacial",
    description: "Estação espacial futurista com tecnologia de ponta",
    category: "SPACE",
    previewUrl: null,
    mapData: {
      scenario: "space",
      gameView: "aerial",
      elements: {
        deskType: "space", showMeetingRooms: true, showCafeteria: false,
        showPlants: false, showCabinets: true, chairType: "rocket",
        showGrass: false, showTrees: false, showFlowers: false,
      },
      rooms: [
        { type: "coworking", enabled: true },
        { type: "reuniao", enabled: true },
        { type: "copa", enabled: false },
        { type: "recepcao", enabled: false },
        { type: "atendimento", enabled: false },
        { type: "cozinha", enabled: false },
      ],
      meetingRoomCount: 3,
    },
  },
  {
    name: "Interior do Foguete",
    description: "Nave espacial por dentro — ambiente industrial e futurista",
    category: "SPACE",
    previewUrl: null,
    mapData: {
      scenario: "rocket",
      gameView: "aerial",
      elements: {
        deskType: "space", showMeetingRooms: true, showCafeteria: true,
        showPlants: false, showCabinets: true, chairType: "rocket",
        showGrass: false, showTrees: false, showFlowers: false,
      },
      rooms: [
        { type: "coworking", enabled: true },
        { type: "reuniao", enabled: true },
        { type: "copa", enabled: true },
        { type: "recepcao", enabled: false },
        { type: "atendimento", enabled: false },
        { type: "cozinha", enabled: false },
      ],
      meetingRoomCount: 2,
    },
  },
  {
    name: "Hub de Inovação",
    description: "Ambiente para startups com áreas de brainstorm e reunião",
    category: "TECH",
    previewUrl: null,
    mapData: {
      scenario: "station",
      gameView: "aerial",
      elements: {
        deskType: "minimal", showMeetingRooms: true, showCafeteria: true,
        showPlants: true, showCabinets: false, chairType: "office",
        showGrass: true, showTrees: true, showFlowers: false,
      },
      rooms: [
        { type: "coworking", enabled: true },
        { type: "reuniao", enabled: true },
        { type: "copa", enabled: true },
        { type: "recepcao", enabled: true },
        { type: "atendimento", enabled: true },
        { type: "cozinha", enabled: false },
      ],
      meetingRoomCount: 4,
    },
  },
  {
    name: "Escritório Executivo",
    description: "Layout premium com salas individuais e área de presidência",
    category: "OFFICE",
    previewUrl: null,
    mapData: {
      scenario: "station",
      gameView: "aerial",
      elements: {
        deskType: "space", showMeetingRooms: true, showCafeteria: true,
        showPlants: true, showCabinets: true, chairType: "rocket",
        showGrass: true, showTrees: true, showFlowers: true,
      },
      rooms: [
        { type: "recepcao", enabled: true },
        { type: "coworking", enabled: true },
        { type: "reuniao", enabled: true },
        { type: "copa", enabled: true },
        { type: "cozinha", enabled: true },
        { type: "atendimento", enabled: false },
      ],
      meetingRoomCount: 6,
    },
  },
  {
    name: "Loft Criativo",
    description: "Espaço aberto estilo loft para equipes criativas",
    category: "OFFICE",
    previewUrl: null,
    mapData: {
      scenario: "station",
      gameView: "aerial",
      elements: {
        deskType: "minimal", showMeetingRooms: false, showCafeteria: false,
        showPlants: true, showCabinets: false, chairType: "office",
        showGrass: true, showTrees: true, showFlowers: true,
      },
      rooms: [
        { type: "coworking", enabled: true },
        { type: "copa", enabled: true },
        { type: "cozinha", enabled: true },
        { type: "reuniao", enabled: false },
        { type: "recepcao", enabled: false },
        { type: "atendimento", enabled: false },
      ],
      meetingRoomCount: 0,
    },
  },
];

async function main() {
  const authorId = await getSystemAuthor();
  console.log(`Using author: ${authorId}`);

  // Limpa templates de sistema existentes (sem stationId)
  const deleted = await prisma.worldTemplate.deleteMany({
    where: { authorId, stationId: null },
  });
  console.log(`Removed ${deleted.count} old system templates`);

  // Insere novos templates
  for (const t of TEMPLATES) {
    await prisma.worldTemplate.create({
      data: {
        ...t,
        authorId,
        isPublic: true,
        usedCount: Math.floor(Math.random() * 50),
      } as Parameters<typeof prisma.worldTemplate.create>[0]['data'],
    });
    console.log(`✓ ${t.name}`);
  }

  console.log(`\nSeeded ${TEMPLATES.length} world templates`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
