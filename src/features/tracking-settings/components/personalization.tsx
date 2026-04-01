"use client";

import { useView } from "@/features/trackings/contexts/use-view";
import { Palette, Columns2, LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function Personalization() {
  const { viewMode, setViewMode } = useView();

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Palette className="size-4" />
            <h2 className="text-xl font-semibold">Personalização</h2>
          </div>
          <p className="text-muted-foreground text-sm">
            Personalize a aparência, estilos e a experiência visual do painel.
          </p>
        </div>
      </div>

      <div className="col-span-4 space-y-6">
        <div className="space-y-3">
          <h3 className="text-lg font-medium">Visualização dos Cards</h3>
          <p className="text-sm text-muted-foreground">
            Escolha o formato de exibição dos leads no quadro Kanban.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            className={cn(
              "cursor-pointer p-6 transition-all hover:border-primary",
              viewMode === "default"
                ? "border-primary ring-2 ring-primary/20 bg-muted/20"
                : "border-border/50"
            )}
            onClick={() => setViewMode("default")}
          >
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "p-3 rounded-lg shrink-0",
                  viewMode === "default"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <LayoutTemplate className="size-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-base">Padrão</h4>
                <p className="text-sm text-muted-foreground">
                  Visualização compacta com as informações essenciais exibidas no card.
                </p>
              </div>
            </div>
          </Card>

          <Card
            className={cn(
              "cursor-pointer p-6 transition-all hover:border-primary",
              viewMode === "modern"
                ? "border-primary ring-2 ring-primary/20 bg-muted/20"
                : "border-border/50"
            )}
            onClick={() => setViewMode("modern")}
          >
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "p-3 rounded-lg shrink-0",
                  viewMode === "modern"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Columns2 className="size-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-base">Moderno</h4>
                <p className="text-sm text-muted-foreground">
                  Cards com visual repaginado e mais espaçamento.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
