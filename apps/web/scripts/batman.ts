import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const station = await prisma.spaceStation.updateMany({
    where: { nick: 'astronasa' },
    data: { isPublic: true },
  });
  console.log('Atualizado:', JSON.stringify(station));
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
