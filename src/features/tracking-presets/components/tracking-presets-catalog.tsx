"use client";

import { useMemo, useState } from "react";
import { useTrackingPresets } from "../hooks/use-tracking-presets";
import { PresetCard, PresetCardData } from "./preset-card";
import { ApplyPresetDialog } from "./apply-preset-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";

type Paradigm = "REATIVO" | "PROATIVO" | "PREDITIVO" | "AUTOATENDIMENTO";

const PARADIGM_ORDER: Paradigm[] = [
  "REATIVO",
  "PROATIVO",
  "PREDITIVO",
  "AUTOATENDIMENTO",
];

const PARADIGM_INFO: Record<
  Paradigm,
  { label: string; description: string; color: string }
> = {
  REATIVO: {
    label: "Reativo",
    description:
      "Cliente entra em contato — empresa atende. Workflows que respondem a eventos do lead.",
    color: "#FF6B6B",
  },
  PROATIVO: {
    label: "Proativo",
    description:
      "Empresa age antes do cliente pedir. Boas-vindas, qualificação automática, distribuição.",
    color: "#4ECDC4",
  },
  PREDITIVO: {
    label: "Preditivo",
    description:
      "IA analisa intenção do cliente e dispara automação adequada. Requer Astro/IA configurado.",
    color: "#7A5FDF",
  },
  AUTOATENDIMENTO: {
    label: "Autoatendimento",
    description:
      "Cliente resolve sozinho via formulários, agenda, NASA Route. Sem intervenção humana.",
    color: "#3DB88B",
  },
};

/**
 * Catálogo agrupado por paradigma. Cada paradigma vira uma seção com cards
 * dos presets do tipo. Click no card abre `<ApplyPresetDialog>`.
 *
 * Stateless quanto a auth — assume que a página pai já garantiu sessão.
 */
export function TrackingPresetsCatalog() {
  const { data, isLoading } = useTrackingPresets();
  const [selected, setSelected] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Agrupa presets por paradigma
  const byParadigm = useMemo(() => {
    const map = new Map<Paradigm, PresetCardData[]>();
    for (const p of PARADIGM_ORDER) map.set(p, []);
    for (const preset of data?.presets ?? []) {
      const arr = map.get(preset.paradigm as Paradigm);
      if (arr) arr.push(preset);
    }
    return map;
  }, [data]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  if (!data?.presets.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <Sparkles className="size-10 mb-3 text-amber-500" />
        <p className="text-sm">Nenhum padrão disponível no catálogo ainda.</p>
        <p className="text-xs">A equipe NASA está montando os primeiros.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8">
        {PARADIGM_ORDER.map((paradigm) => {
          const presets = byParadigm.get(paradigm) ?? [];
          if (presets.length === 0) return null;
          const info = PARADIGM_INFO[paradigm];
          return (
            <section key={paradigm}>
              <div className="mb-3 flex items-baseline gap-3">
                <h2
                  className="text-lg font-semibold inline-flex items-center gap-2"
                  style={{ color: info.color }}
                >
                  {info.label}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {info.description}
                </p>
              </div>
              {/* Layout responsivo simples:
                  - Mobile (< sm): 2 cols (até 4 cards = 2x2)
                  - sm+: 4 cols em linha única (todos lado a lado)
                  Cards se ajustam à largura disponível. */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {presets.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    onClick={() =>
                      setSelected({ id: preset.id, name: preset.name })
                    }
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {selected && (
        <ApplyPresetDialog
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
          presetId={selected.id}
          presetName={selected.name}
        />
      )}
    </>
  );
}
