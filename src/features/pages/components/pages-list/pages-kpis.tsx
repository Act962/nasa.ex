import { CircleCheck, FilePen, LayoutGrid, Star } from "lucide-react";
import type { ReactNode } from "react";

export function PagesKpis({
  siteCount,
  publishedCount,
  draftCount,
  starsPerSite,
}: {
  siteCount: number;
  publishedCount: number;
  draftCount: number;
  starsPerSite: number | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
      <PagesKpiCard icon={<LayoutGrid className="size-4" />} label="Sites" value={siteCount.toLocaleString("pt-BR")} />
      <PagesKpiCard
        icon={<CircleCheck className="size-4 text-success" />}
        label="Publicados"
        value={publishedCount.toLocaleString("pt-BR")}
      />
      <PagesKpiCard icon={<FilePen className="size-4" />} label="Rascunhos" value={draftCount.toLocaleString("pt-BR")} />
      <PagesKpiCard
        icon={<Star className="size-4 text-warning" />}
        label="Custo por site"
        value={starsPerSite === null ? "—" : `${starsPerSite.toLocaleString("pt-BR")} Stars`}
      />
    </div>
  );
}

function PagesKpiCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[18px] border border-line bg-card p-3 md:p-4">
      <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className="truncate text-lg font-bold md:text-xl">{value}</span>
    </div>
  );
}
