import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const trackingId = process.argv[2];
  const numUsers = parseInt(process.argv[3] || "5", 10);

  if (!trackingId) {
    console.error("❌ Por favor, informe o ID do tracking.");
    console.log("👉 Uso: npx tsx prisma/seed-users-tracking.ts <TRACKING_ID> [NUM_USERS]");
    process.exit(1);
  }

  console.log(`🌱 Iniciando seed de ${numUsers} usuários para o tracking: ${trackingId}...`);

  // Verifica se o tracking existe
  const tracking = await prisma.tracking.findUnique({
    where: { id: trackingId },
  });

  if (!tracking) {
    console.error("❌ Tracking não encontrado!");
    process.exit(1);
  }

  let inserted = 0;

  for (let i = 1; i <= numUsers; i++) {
    const uniqueHash = Math.random().toString(36).substring(2, 7);
    const email = `consultor${i}.${uniqueHash}@teste.com`;
    
    // 1. Cria o usuário
    const user = await prisma.user.create({
      data: {
        name: `Consultor Teste ${i}`,
        email,
        isActive: true,
      },
    });

    // 2. Adiciona como participante do tracking (MEMBER)
    await prisma.trackingParticipant.create({
      data: {
        userId: user.id,
        trackingId,
        role: "MEMBER",
      },
    });

    // 3. Adiciona como Tracking Consultant (para rodízio de leads)
    await prisma.trackingConsultant.create({
      data: {
        userId: user.id,
        trackingId,
        maxFlow: 10, // Defina um limite padrão para testes de rodízio
        isActive: true,
      },
    });

    inserted++;
  }

  console.log(`✅ Seed concluído com sucesso!`);
  console.log(`   ${inserted} usuários criados e vinculados ao tracking (como Participantes e Consultores).`);
}

main()
  .catch((e) => {
    console.error("❌ Erro ao rodar o seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
