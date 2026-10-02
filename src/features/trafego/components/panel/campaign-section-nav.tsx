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

export const CAMPAIGN_SECTION_LABEL: Record<CampaignSection, string> = {
  materiais: "Materiais",
  release: "Release",
  acessos: "Acessos",
  andamento: "Andamento",
  desempenho: "Desempenho",
  suporte: "Suporte",
};

export const CAMPAIGN_SECTION_SUBTITLE: Record<CampaignSection, string> = {
  materiais: "Imagens, textos e destino do anúncio",
  release: "Resumo da sua empresa para os anúncios",
  acessos: "O que a equipe precisa para publicar",
  andamento: "Em que fase a campanha está",
  desempenho: "Resultados e verba usada",
  suporte: "Converse com a nossa equipe",
};

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
      label: CAMPAIGN_SECTION_LABEL.materiais,
      icon: FolderOpen,
      done: completion.materiais,
    },
    {
      value: "release",
      label: CAMPAIGN_SECTION_LABEL.release,
      icon: FileText,
      done: completion.release,
    },
    {
      value: "acessos",
      label: CAMPAIGN_SECTION_LABEL.acessos,
      icon: KeyRound,
      done: completion.acessos,
    },
    {
      value: "andamento",
      label: CAMPAIGN_SECTION_LABEL.andamento,
      icon: Activity,
      done: completion.andamento,
    },
    {
      value: "desempenho",
      label: CAMPAIGN_SECTION_LABEL.desempenho,
      icon: BarChart3,
      done: completion.desempenho,
    },
    {
      value: "suporte",
      label: CAMPAIGN_SECTION_LABEL.suporte,
      icon: Headphones,
    },
  ];
  const items = baseItems.map((item) => ({
    ...item,
    needsAttention: item.value === nextIncomplete,
  }));

  return (
    <nav
      aria-label="Etapas da campanha"
      className="scroll-hidden-x -mx-4 mt-3 px-4 md:mx-0 md:px-0"
    >
      <TabsList className="h-auto w-max justify-start gap-1 p-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <TabsTrigger
              key={item.value}
              value={item.value}
              className={cn(
                "relative min-h-9 flex-none shrink-0 gap-1.5 px-3 text-xs",
                item.done && "text-success",
                item.needsAttention &&
                  "border-warning/30 bg-warning/15 text-warning motion-safe:animate-pulse",
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
