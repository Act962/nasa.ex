/**
 * Reseta a senha de um usuário LOCAL — gera o hash via better-auth
 * (mesmo algoritmo do login) e grava direto na tabela `account` do
 * provider "credential".
 *
 * Uso:
 *   pnpm tsx scripts/reset-password-local.ts <email> <novaSenha>
 *
 * Exemplo:
 *   pnpm tsx scripts/reset-password-local.ts duascarasnasa@gmail.com minhasenha123
 *
 * Detalhes:
 *   - `auth.$context.password.hash` gera o hash com o mesmo formato que
 *     o login espera (scrypt). UPDATE direto com bcrypt/etc. quebra.
 *   - Se o usuário ainda não tem account "credential" (ex: foi criado
 *     só via Google OAuth), cria uma. Senão atualiza a existente.
 *   - Apenas pra dev local — não rode em produção.
 */
import "dotenv/config";
import { auth } from "../src/lib/auth";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Detecta dev local (localhost/127.0.0.1) — Postgres do docker-compose
// roda sem SSL. Em produção/staging força SSL com cert flexível.
const isLocal = /@(localhost|127\.0\.0\.1)/.test(
  process.env.DATABASE_URL ?? "",
);
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: isLocal ? false : { rejectUnauthorized: false },
} as any);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const [, , email, newPassword] = process.argv;
  if (!email || !newPassword) {
    console.error(
      "Uso: pnpm tsx scripts/reset-password-local.ts <email> <novaSenha>",
    );
    process.exit(1);
  }
  if (newPassword.length < 8) {
    console.error("Senha precisa ter pelo menos 8 caracteres.");
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    console.error(`Usuário não encontrado: ${email}`);
    process.exit(1);
  }

  // Gera hash compatível com o login do better-auth.
  // `auth.$context` é uma promise — resolve pra um objeto com helpers
  // internos, incluindo `password.hash`.
  const ctx = await (auth as any).$context;
  const hashed: string = await ctx.password.hash(newPassword);

  const credentialAccount = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
    select: { id: true },
  });

  if (credentialAccount) {
    await prisma.account.update({
      where: { id: credentialAccount.id },
      data: { password: hashed },
    });
    console.log(`✅ Senha atualizada (account existente).`);
  } else {
    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: hashed,
      },
    });
    console.log(`✅ Account "credential" criada com a nova senha.`);
  }

  console.log(`   usuário: ${user.name} <${user.email}>`);
  console.log(`   id:      ${user.id}`);
  console.log(`   senha:   ${newPassword}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
