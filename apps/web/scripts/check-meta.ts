import prisma from "@/lib/prisma";

async function main() {
  const integrations = await prisma.platformIntegration.findMany({
    where: { platform: { in: ["META", "INSTAGRAM"] } },
    select: { id: true, organizationId: true, platform: true, isActive: true, config: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });
  if (integrations.length === 0) {
    console.log("Nenhuma integracao META/INSTAGRAM encontrada.");
  }
  for (const i of integrations) {
    const cfg = (i.config ?? {}) as Record<string, unknown>;
    console.log(`---`);
    console.log(`platform=${i.platform} active=${i.isActive} org=${i.organizationId}`);
    console.log(`hasAccessToken=${Boolean(cfg.accessToken || cfg.access_token)}`);
    console.log(`adAccountId=${cfg.adAccountId ?? "(none)"}`);
    console.log(`userName=${cfg.userName ?? "(none)"}`);
    console.log(`scopes=${Array.isArray(cfg.scopes) ? (cfg.scopes as string[]).length : 0}`);
    console.log(`pages=${Array.isArray(cfg.pages) ? (cfg.pages as unknown[]).length : 0}`);
    console.log(`adAccounts=${Array.isArray(cfg.adAccounts) ? (cfg.adAccounts as unknown[]).length : 0}`);
    console.log(`igAccounts=${Array.isArray(cfg.igAccounts) ? (cfg.igAccounts as unknown[]).length : 0}`);
    console.log(`selectedAdAccountIds=${JSON.stringify(cfg.selectedAdAccountIds ?? [])}`);
    console.log(`updatedAt=${i.updatedAt.toISOString()}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
