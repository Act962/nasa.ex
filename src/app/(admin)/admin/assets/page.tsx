import { requireAdminSession } from "@/lib/admin-utils";
import prisma from "@/lib/prisma";
import { AssetsManager } from "@/features/admin/components/assets/assets-manager";
import { ImageIcon } from "lucide-react";
import { integrations } from "@/data/integrations";

const ALL_APPS = [
  { slug: "tracking",        label: "Tracking (CRM)",   emoji: "📊" },
  { slug: "chat",            label: "NASA Chat",         emoji: "💬" },
  { slug: "forge",           label: "Forge",             emoji: "🔨" },
  { slug: "spacetime",       label: "SpaceTime",         emoji: "🗓️" },
  { slug: "nasa-planner",    label: "NASA Planner",      emoji: "📸" },
  { slug: "insights",        label: "Insights",          emoji: "📊" },
  { slug: "integrations",    label: "Integrações",       emoji: "🔗" },
  { slug: "explorer",        label: "NASA Explorer",     emoji: "🚀" },
  { slug: "nbox",            label: "N-Box",             emoji: "📦" },
  { slug: "forge-contracts", label: "Forge Contracts",   emoji: "📝" },
];

const PLATFORM_KEYS = [
  { key: "platform:logo",             label: "Logo principal",          hint: "PNG/SVG, fundo transparente" },
  { key: "platform:logo_dark",        label: "Logo modo escuro",        hint: "Versão clara para fundos escuros" },
  { key: "platform:space_point_icon", label: "Ícone Space Point",       hint: "Ícone principal do módulo" },
  { key: "platform:helmet",           label: "Capacete Astronauta",     hint: "Usado no ranking e selos" },
  { key: "platform:rocket_cursor",    label: "Cursor Foguete",          hint: "SVG do cursor" },
  { key: "platform:favicon",          label: "Favicon",                 hint: "32×32 ou 64×64 PNG" },
];

export default async function AssetsPage() {
  await requireAdminSession();

  const [levels, assetRows] = await Promise.all([
    prisma.spacePointLevel.findMany({ orderBy: { order: "asc" } }),
    prisma.platformAsset.findMany(),
  ]);

  const assetsMap: Record<string, string> = Object.fromEntries(assetRows.map((r) => [r.key, r.url]));

  const integrationList = integrations.map((i) => ({
    slug:     i.slug,
    name:     i.name,
    category: i.category,
    icon:     i.icon,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center">
          <ImageIcon className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Padrão Visual</h1>
          <p className="text-sm text-zinc-400">Gerencie ícones, selos, imagens de marca e popups da plataforma</p>
        </div>
      </div>

      <AssetsManager
        levels={levels.map((l) => ({
          id:             l.id,
          order:          l.order,
          name:           l.name,
          requiredPoints: l.requiredPoints,
          badgeNumber:    l.badgeNumber,
          planetEmoji:    l.planetEmoji,
        }))}
        apps={ALL_APPS}
        integrations={integrationList}
        platformKeys={PLATFORM_KEYS}
        assetsMap={assetsMap}
      />
    </div>
  );
}
