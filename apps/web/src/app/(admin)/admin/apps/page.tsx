import { requireAdminSession } from "@/features/admin/lib/admin-utils";
import prisma from "@/lib/prisma";
import { AppCostManager } from "@/features/admin/components/app-cost-manager";

const ALL_APPS = [
  { slug: "tracking",        label: "Tracking (CRM)" },
  { slug: "chat",            label: "NASA Chat" },
  { slug: "forge",           label: "Forge" },
  { slug: "spacetime",       label: "SpaceTime" },
  { slug: "nasa-planner",    label: "NASA Planner" },
  { slug: "insights",        label: "Insights" },
  { slug: "integrations",    label: "Integrações" },
  { slug: "explorer",        label: "NASA Explorer" },
  { slug: "nbox",            label: "N-Box" },
  { slug: "forge-contracts", label: "Forge Contracts" },
];

export default async function AppsPage() {
  await requireAdminSession();

  const costs = await prisma.appStarCost.findMany({ orderBy: { appSlug: "asc" } });
  const costMap: Record<string, typeof costs[0]> = {};
  for (const c of costs) costMap[c.appSlug] = c;

  const appData = ALL_APPS.map((app) => {
    const c = costMap[app.slug] ?? null;
    return {
      ...app,
      cost: c ? { id: c.id, monthlyCost: c.monthlyCost, setupCost: c.setupCost, priceBrl: c.priceBrl?.toString() ?? null } : null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Configuração dos Apps</h1>
        <p className="text-sm text-zinc-400 mt-1">Custo em Stars por aplicativo</p>
      </div>

      <AppCostManager apps={appData} />
    </div>
  );
}
