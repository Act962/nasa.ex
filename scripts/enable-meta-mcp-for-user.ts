import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

const TARGET_EMAIL = "coringaforevernasa@gmail.com";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    include: {
      members: {
        include: { organization: { select: { id: true, name: true } } },
      },
    },
  });
  if (!user) {
    console.error("❌ user not found");
    return;
  }
  const orgMember = user.members[0];
  if (!orgMember) {
    console.error("❌ user without org");
    return;
  }
  const org = orgMember.organization;
  console.log(`✅ user: ${user.name} | org: ${org.name}`);

  const integration = await prisma.platformIntegration.findUnique({
    where: {
      organizationId_platform: { organizationId: org.id, platform: "META" },
    },
  });

  if (!integration) {
    console.log("⚠️  Sem PlatformIntegration Meta — criando uma fake pra teste");
    await prisma.platformIntegration.create({
      data: {
        platform: "META",
        organizationId: org.id,
        isActive: true,
        config: {
          accessToken: "fake_token_for_testing_seed_data_only",
          adAccountId: "act_seed-meta-demo",
          mcpEnabled: true,
          mcpAllowedOps: ["read", "pause", "resume"],
          mcpMaxBudgetPerCampaign: 500,
          mcpDefaultModel: "openai:gpt-4.1-nano",
          mcpEnabledAt: new Date().toISOString(),
          mcpEnabledBy: user.id,
        } as any,
      },
    });
    console.log("✅ PlatformIntegration META criada com mcpEnabled:true");
  } else {
    const existing = (integration.config ?? {}) as Record<string, unknown>;
    await prisma.platformIntegration.update({
      where: { id: integration.id },
      data: {
        isActive: true,
        config: {
          ...existing,
          accessToken: existing.accessToken ?? "fake_token_for_testing_seed_data_only",
          adAccountId: existing.adAccountId ?? "act_seed-meta-demo",
          mcpEnabled: true,
          mcpAllowedOps: existing.mcpAllowedOps ?? ["read", "pause", "resume"],
          mcpMaxBudgetPerCampaign: existing.mcpMaxBudgetPerCampaign ?? 500,
          mcpDefaultModel: existing.mcpDefaultModel ?? "openai:gpt-4.1-nano",
          mcpEnabledAt: existing.mcpEnabledAt ?? new Date().toISOString(),
          mcpEnabledBy: existing.mcpEnabledBy ?? user.id,
        } as any,
      },
    });
    console.log("✅ MCP habilitado em PlatformIntegration existente");
  }

  console.log("\nPronto. Acesse /insights/relatorios e digite ao Astro.");
}

main().finally(() => prisma.$disconnect());
