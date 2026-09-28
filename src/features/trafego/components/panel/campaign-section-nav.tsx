import {
  Activity,
  BarChart3,
  CheckCircle2,
  FileText,
  FolderOpen,
  Headphones,
  KeyRound,
  type LucideIcon,
} from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type CampaignSection =
  | "materiais"
  | "release"
  | "acessos"
  | "andamento"
  | "desempenho"
  | "suporte";

interface SectionItem {
  value: CampaignSection;
  label: string;
  icon: LucideIcon;
  done?: boolean;
  needsAttention?: boolean;
}

export function CampaignSectionNav({
  completion,
  nextIncomplete,
}: {
  completion: Partial<Record<CampaignSection, boolean>>;
  nextIncomplete: CampaignSection | null;
}) {
  const baseItems: SectionItem[] = [
    {
      value: "materiais",
      label: "Materiais",
      icon: FolderOpen,
      done: completion.materiais,
    },
    {
      value: "release",
      label: "Release",
      icon: FileText,
      done: completion.release,
    },
    {
      value: "acessos",
      label: "Acessos",
      icon: KeyRound,
      done: completion.acessos,
    },
    {
      value: "andamento",
      label: "Andamento",
      icon: Activity,
      done: completion.andamento,
    },
    {
      value: "desempenho",
      label: "Desempenho",
      icon: BarChart3,
      done: completion.desempenho,
    },
    { value: "suporte", label: "Suporte", icon: Headphones },
  ];
  const items = baseItems.map((item) => ({
    ...item,
    needsAttention: item.value === nextIncomplete,
  }));

  return (
    <nav aria-label="Etapas da campanha" className="mt-3">
      <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border bg-card p-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <TabsTrigger
              key={item.value}
              value={item.value}
              className={cn(
                "relative min-h-10 shrink-0 gap-1.5 rounded-lg border border-transparent px-3 text-xs data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-sm",
                item.done && "text-emerald-600 dark:text-emerald-400",
                item.needsAttention &&
                  "border-amber-400/70 bg-amber-500/[0.06] text-amber-700 motion-safe:animate-pulse dark:text-amber-300",
              )}
            >
              {item.done ? (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              ) : (
                <Icon className="size-4" aria-hidden="true" />
              )}
              {item.label}
              {item.needsAttention && (
                <span className="sr-only">
                  {" "}
                  — há itens pendentes nesta etapa
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </nav>
  );
}
