import { requireAdminSession } from "@/features/admin/lib/admin-utils";
import prisma from "@/lib/prisma";
import { WorldAssetsManager } from "@/features/admin/components/space-station/world-assets-manager";
import { Globe } from "lucide-react";
import type { WorldGameAsset } from "@/features/space-station/types";

export default async function AdminSpaceStationPage() {
  await requireAdminSession();

  const rows = await prisma.worldGameAsset.findMany({ orderBy: { createdAt: "asc" } });

  const assets: WorldGameAsset[] = rows.map((r) => ({
    id: r.id,
    type: r.type as WorldGameAsset["type"],
    name: r.name,
    imageUrl: r.imageUrl,
    previewUrl: r.previewUrl,
    config: r.config as Record<string, unknown> | null,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center">
          <Globe className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Space Station — Assets</h1>
          <p className="text-sm text-zinc-400">
            Gerencie os modelos disponíveis no mundo virtual: visões, móveis, cadeiras, mesas e computadores
          </p>
        </div>
      </div>

      <WorldAssetsManager initialAssets={assets} />
    </div>
  );
}
