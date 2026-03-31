/**
 * Script: set-moderator.ts
 *
 * Define o usuário Astro (astro@gmail.com) como "moderador" em TODAS as
 * organizações às quais ele pertence.
 *
 * Moderadores recebem reabastecimento automático de estrelas quando o saldo
 * cai para ≤ 100 ★ — o sistema recarrega para 1.000.000 ★ automaticamente.
 *
 * Uso:
 *   npx tsx prisma/set-moderator.ts
 */

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const MODERATOR_EMAIL = "astro@gmail.com";

async function main() {
  // Localiza o usuário pelo e-mail
  const user = await prisma.user.findUnique({
    where: { email: MODERATOR_EMAIL },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    console.error(`❌  Usuário "${MODERATOR_EMAIL}" não encontrado.`);
    process.exit(1);
  }

  console.log(`✅  Usuário encontrado: ${user.name ?? user.email} (${user.id})`);

  // Atualiza o role para "moderador" em todas as organizações do usuário
  const updated = await prisma.member.updateMany({
    where: { userId: user.id },
    data: { role: "moderador" },
  });

  if (updated.count === 0) {
    console.warn(
      `⚠️  Nenhum vínculo de membro encontrado para "${MODERATOR_EMAIL}".`,
    );
  } else {
    console.log(
      `🌟  Role "moderador" aplicado em ${updated.count} organização(ões).`,
    );
  }

  // Exibe as organizações afetadas
  const members = await prisma.member.findMany({
    where: { userId: user.id },
    include: { organization: { select: { id: true, name: true } } },
  });

  for (const m of members) {
    console.log(
      `   • [${m.role}] ${m.organization.name} (org: ${m.organization.id})`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
