import prisma from "@/lib/prisma";
import { listMetaCampaigns } from "@/http/meta/ads-management";

async function main() {
  const integration = await prisma.platformIntegration.findFirst({
    where: { platform: "META", isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!integration) {
    console.log("Nenhuma integracao META ativa.");
    process.exit(1);
  }
  const cfg = (integration.config ?? {}) as Record<string, string>;
  const accessToken = cfg.accessToken;
  const adAccountId = cfg.adAccountId;
  if (!accessToken || !adAccountId) {
    console.log("accessToken ou adAccountId ausente no config.");
    process.exit(1);
  }
  console.log(`Buscando campanhas em ${adAccountId} ...`);
  const campaigns = await listMetaCampaigns({ accessToken, adAccountId });
  console.log(`\n=== ${campaigns.length} campanha(s) encontrada(s) ===\n`);
  for (const c of campaigns.slice(0, 20)) {
    console.log(`- [${c.status ?? "?"}] ${c.name} (id=${c.id}, objective=${c.objective ?? "-"})`);
  }
  if (campaigns.length > 20) console.log(`... e mais ${campaigns.length - 20}`);
  process.exit(0);
}
main().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
