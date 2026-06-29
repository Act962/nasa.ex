/**
 * Adiciona coverImage às ações criadas pelo seed, distribuindo imagens
 * temáticas do Unsplash (CDN público).
 *
 * Uso:
 *   npx tsx scripts/seed-actions-images.ts
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
} as any);
const prisma = new PrismaClient({ adapter } as any);

// Imagens livres do Unsplash (CDN público — sem necessidade de download)
const COVERS: Record<string, string> = {
  "[SEED] Daily standup":
    "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&q=75",
  "[SEED] Reunião com cliente — Acme":
    "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&q=75",
  "[SEED] Sprint planning":
    "https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400&q=75",
  "[SEED] Revisão de código — Auth":
    "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=400&q=75",
  "[SEED] Demo de produto":
    "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=400&q=75",
  "[SEED] 1:1 com líder":
    "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400&q=75",
  "[SEED] Workshop de descoberta":
    "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400&q=75",
  "[SEED] Entrega da proposta":
    "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=400&q=75",
  "[SEED] Follow-up Linnker":
    "https://images.unsplash.com/photo-1531497865144-0464ef8fb9a9?w=400&q=75",
  "[SEED] Treinamento NASA Forge":
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&q=75",
  "[SEED] Calibração de processo":
    "https://images.unsplash.com/photo-1581090700227-1e37b190418e?w=400&q=75",
  "[SEED] Apresentação executiva":
    "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=400&q=75",
  "[SEED] Retro mensal":
    "https://images.unsplash.com/photo-1558403194-611308249627?w=400&q=75",
  "[SEED] Onboarding novo membro":
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&q=75",
  "[SEED] Planejamento Q2":
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&q=75",
};

async function main() {
  let updated = 0;
  for (const [title, cover] of Object.entries(COVERS)) {
    const result = await prisma.action.updateMany({
      where: { title },
      data: { coverImage: cover },
    });
    if (result.count > 0) {
      updated += result.count;
      console.log(`✓ ${title}  (${result.count} atualizadas)`);
    } else {
      console.log(`⊘ ${title}  (não encontrada)`);
    }
  }
  console.log(`\n✅ ${updated} ações com coverImage`);
}

main()
  .catch((e) => {
    console.error("ERRO:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
