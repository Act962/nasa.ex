import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { DEFAULT_RULES } from "../src/app/router/space-point/defaults";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Iniciando seed de Space Point Rules...");
  
  let inserted = 0;
  let updated = 0;

  for (const rule of DEFAULT_RULES) {
    const { category: _cat, ...data } = rule;
    
    // Verifica se já existe para fins de log
    const exists = await prisma.spacePointRule.findUnique({
      where: { action: rule.action }
    });

    await prisma.spacePointRule.upsert({
      where: { action: rule.action },
      create: data,
      update: data, // Atualiza nome ou pontos se tiver sofrido mudanças no defaults
    });

    if (exists) {
      updated++;
    } else {
      inserted++;
    }
  }

  console.log(`✅ Seed concluído!`);
  console.log(`   Inseridas: ${inserted}`);
  console.log(`   Atualizadas: ${updated}`);
}

main()
  .catch((e) => {
    console.error("❌ Erro ao rodar o seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
