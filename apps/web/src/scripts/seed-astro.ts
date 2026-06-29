import prisma from "../lib/prisma";
import { StarTransactionType } from "../generated/prisma/enums";

async function main() {
  // ── 1. Garantir plano constellation ───────────────────────────────────────
  let plan = await prisma.plan.findUnique({ where: { slug: "constellation" } });
  if (!plan) {
    plan = await prisma.plan.create({
      data: {
        slug: "constellation",
        name: "Constellation",
        monthlyStars: 100_000,
        priceMonthly: 997,
        maxUsers: 50,
        rolloverPct: 50,
        isActive: true,
      },
    });
    console.log("✅ Plano Constellation criado:", plan.id);
  } else {
    console.log("✅ Plano Constellation já existe:", plan.id);
  }

  // ── 2. Usuário Astro ───────────────────────────────────────────────────────
  let user = await prisma.user.findFirst({ where: { email: "astro@gmail.com" } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Astro",
        email: "astro@gmail.com",
        emailVerified: true,
      },
    });
    console.log("✅ Usuário Astro criado:", user.id);
  } else {
    console.log("✅ Usuário Astro já existe:", user.id);
  }

  // ── 3. Organização Astro Inc. ──────────────────────────────────────────────
  let org = await (prisma.organization as any).findFirst({
    where: { name: { contains: "Astro", mode: "insensitive" } },
    include: { members: true },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "Astro Inc.",
        slug: "astro-inc",
        createdAt: new Date(),
        planId: plan.id,
        starsBalance: 0,
        starsCycleStart: new Date(),
        members: {
          create: {
            userId: user.id,
            role: "owner",
            createdAt: new Date(),
          },
        },
      },
      include: { members: true },
    });
    console.log("✅ Org Astro Inc. criada:", org.id);
  } else {
    org = await prisma.organization.update({
      where: { id: org.id },
      data: { planId: plan.id },
      include: { members: true },
    });
    console.log("✅ Org já existe, plano atualizado:", org.id);

    const isMember = org.members.some((m: any) => m.userId === user!.id);
    if (!isMember) {
      await prisma.member.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: "owner",
          createdAt: new Date(),
        },
      });
      console.log("✅ Usuário adicionado como owner");
    }
  }

  // ── 4. Creditar 1.000.000 de stars ────────────────────────────────────────
  const updatedOrg = await prisma.organization.update({
    where: { id: org.id },
    data: { starsBalance: 1_000_000 },
  });

  await prisma.starTransaction.create({
    data: {
      organizationId: org.id,
      type: StarTransactionType.MANUAL_ADJUST,
      amount: 1_000_000,
      balanceAfter: 1_000_000,
      description: "Crédito inicial — usuário de testes Astro Inc.",
      appSlug: "admin",
    },
  });

  console.log(`\n🌟 Stars creditadas: 1.000.000 ★`);
  console.log(`   Saldo final : ${updatedOrg.starsBalance.toLocaleString("pt-BR")} ★`);
  console.log(`\n📋 Resumo:`);
  console.log(`   Usuário  : ${user.name} <${user.email}> — ${user.id}`);
  console.log(`   Org      : ${org.name} — ${org.id}`);
  console.log(`   Plano    : ${plan.name} (${plan.slug})`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ Erro:", e.message);
    process.exit(1);
  });
