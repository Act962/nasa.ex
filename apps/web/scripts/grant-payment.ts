import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import bcrypt from "bcryptjs";

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function main() {
  const targetEmail = process.argv[2];
  const role = (process.argv[3] ?? "OWNER") as
    | "VIEWER"
    | "EDITOR"
    | "ADMIN"
    | "OWNER";
  if (!targetEmail) {
    console.error("Uso: tsx scripts/grant-payment.ts <email> [ROLE]");
    process.exit(1);
  }

  const { default: prisma } = await import("../src/lib/prisma");

  const targetUser = await prisma.user.findUnique({
    where: { email: targetEmail.toLowerCase() },
    select: { id: true, name: true, email: true, phone: true },
  });
  if (!targetUser) {
    console.error(`Usuário não encontrado: ${targetEmail}`);
    process.exit(1);
  }

  const members = await prisma.member.findMany({
    where: { userId: targetUser.id },
    select: { organizationId: true, role: true, organization: { select: { name: true } } },
  });
  if (members.length === 0) {
    console.error(`Usuário ${targetUser.email} não pertence a nenhuma organização.`);
    process.exit(1);
  }
  const target = members[0];

  const pin = generatePin();
  const hash = await bcrypt.hash(pin, 12);

  const access = await prisma.paymentAccess.upsert({
    where: {
      userId_organizationId: {
        userId: targetUser.id,
        organizationId: target.organizationId,
      },
    },
    create: {
      userId: targetUser.id,
      organizationId: target.organizationId,
      passwordHash: hash,
      isAuthorized: true,
      role,
      authorizedById: targetUser.id,
      phone: targetUser.phone ?? null,
    },
    update: {
      passwordHash: hash,
      isAuthorized: true,
      role,
      phone: targetUser.phone ?? undefined,
    },
  });

  console.log("\n✅ PaymentAccess criado/atualizado:\n");
  console.log(`  Usuário:        ${targetUser.name} (${targetUser.email})`);
  console.log(`  Organização:    ${target.organization.name} (${target.organizationId})`);
  console.log(`  Role:           ${role}`);
  console.log(`  Phone do user:  ${targetUser.phone ?? "(sem telefone — entre em Geral pra cadastrar)"}`);
  console.log(`  Access ID:      ${access.id}`);
  console.log("\n🔐 Senha (mostre só agora — hash gravado, texto plano não fica):\n");
  console.log(`     ${pin}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
