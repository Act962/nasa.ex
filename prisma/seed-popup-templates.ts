import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function seedPopupTemplates() {
  console.log("🌱 Seeding popup templates...");

  const templates = [
    // Achievement Templates
    {
      name: "Parabéns - Lua",
      type: "achievement",
      title: "Parabéns você chegou na Lua 🌙",
      message: "Você conquistou um grande feito e desbloqueou uma nova etapa",
      primaryColor: "#7a1fe7",
      accentColor: "#a855f7",
      backgroundColor: "#1a0a3d",
      textColor: "#ffffff",
      enableConfetti: true,
      enableSound: true,
      dismissDuration: 5000,
    },
    {
      name: "Parabéns - Marte",
      type: "achievement",
      title: "Parabéns você chegou em Marte 🔴",
      message: "Missão cumprida com sucesso! Você é incrivelmente produtivo",
      primaryColor: "#dc2626",
      accentColor: "#ef4444",
      backgroundColor: "#3d1010",
      textColor: "#ffffff",
      enableConfetti: true,
      enableSound: true,
      dismissDuration: 5000,
    },
    {
      name: "Parabéns - Vénus",
      type: "achievement",
      title: "Parabéns você chegou em Vénus ✨",
      message: "Excelente desempenho! Você está entre os melhores",
      primaryColor: "#f59e0b",
      accentColor: "#fbbf24",
      backgroundColor: "#3d2a1a",
      textColor: "#ffffff",
      enableConfetti: true,
      enableSound: true,
      dismissDuration: 5000,
    },
    {
      name: "Parabéns - Júpiter",
      type: "achievement",
      title: "Parabéns você chegou em Júpiter 🪐",
      message: "Um grande passo para sua jornada espacial",
      primaryColor: "#8b5cf6",
      accentColor: "#a78bfa",
      backgroundColor: "#2a1f3d",
      textColor: "#ffffff",
      enableConfetti: true,
      enableSound: true,
      dismissDuration: 5000,
    },

    // Stars Reward Templates
    {
      name: "Bonus Stars",
      type: "stars_reward",
      title: "Você recebeu Stars ⭐",
      message: "Parabéns! Você ganhou Stars como recompensa",
      primaryColor: "#fbbf24",
      accentColor: "#fcd34d",
      backgroundColor: "#3d2a0a",
      textColor: "#ffffff",
      enableConfetti: true,
      enableSound: true,
      dismissDuration: 5000,
    },
    {
      name: "Prêmio Especial",
      type: "stars_reward",
      title: "Prêmio Especial Desbloqueado! 🎁",
      message: "Você conquistou uma recompensa exclusiva",
      primaryColor: "#ec4899",
      accentColor: "#f472b6",
      backgroundColor: "#3d1a28",
      textColor: "#ffffff",
      enableConfetti: true,
      enableSound: true,
      dismissDuration: 5000,
    },

    // Level Up Templates
    {
      name: "Level Up Padrão",
      type: "level_up",
      title: "Novo Nível Desbloqueado! 🎉",
      message: "Você está evoluindo rapidamente na sua jornada",
      primaryColor: "#7a1fe7",
      accentColor: "#a855f7",
      backgroundColor: "#1a0a3d",
      textColor: "#ffffff",
      enableConfetti: true,
      enableSound: true,
      dismissDuration: 5000,
    },
  ];

  for (const template of templates) {
    const exists = await prisma.achievementPopupTemplate.findFirst({
      where: { name: template.name },
    });

    if (!exists) {
      await prisma.achievementPopupTemplate.create({
        data: {
          ...template,
          isActive: true,
        },
      });
      console.log(`✅ Created template: ${template.name}`);
    } else {
      console.log(`⏭️  Template already exists: ${template.name}`);
    }
  }

  console.log("✨ Popup templates seeded!");
}

seedPopupTemplates()
  .catch((e) => {
    console.error("Error seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
