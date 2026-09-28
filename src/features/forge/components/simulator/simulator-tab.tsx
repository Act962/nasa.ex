"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2 } from "lucide-react";
import { formatBrl } from "@/features/ia/lib/token-pricing";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useForgeSimulations,
  useDeleteForgeSimulation,
} from "@/features/forge/hooks/use-forge-simulations";
import { SimulationBuilder } from "./simulation-builder";
import { PriceCatalogManager } from "./price-catalog-manager";
import { PriceSuggestionsPanel } from "./price-suggestions-panel";

export function SimulatorTab() {
  const [editing, setEditing] = useState<{ id?: string } | null>(null);

  if (editing) {
    return <SimulationBuilder simulationId={editing.id} onClose={() => setEditing(null)} />;
  }

  return (
    <Tabs defaultValue="simulations" className="space-y-4">
      <TabsList>
        <TabsTrigger value="simulations">Simulações</TabsTrigger>
        <TabsTrigger value="catalog">Catálogo de preços</TabsTrigger>
        <TabsTrigger value="suggestions">Sugestões</TabsTrigger>
      </TabsList>

      <TabsContent value="simulations">
        <SimulationsList onNew={() => setEditing({})} onOpen={(id) => setEditing({ id })} />
      </TabsContent>
      <TabsContent value="catalog">
        <PriceCatalogManager />
      </TabsContent>
      <TabsContent value="suggestions">
        <PriceSuggestionsPanel />
      </TabsContent>
    </Tabs>
  );
}

function SimulationsList({
  onNew,
  onOpen,
}: {
  onNew: () => void;
  onOpen: (id: string) => void;
}) {
  const { data, isLoading } = useForgeSimulations();
  const deleteMutation = useDeleteForgeSimulation();
  const simulations = data?.simulations ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={onNew} className="bg-[#7C3AED] hover:bg-[#6D28D9]">
          <Plus className="mr-1 size-4" /> Nova simulação
        </Button>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Modo</TableHead>
              <TableHead className="text-right">Custo interno</TableHead>
              <TableHead className="text-right">Preço ao cliente</TableHead>
              <TableHead>Proposta</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && simulations.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Nenhuma simulação ainda. Crie a primeira.
                </TableCell>
              </TableRow>
            )}
            {simulations.map((sim) => (
              <TableRow
                key={sim.id}
                className="cursor-pointer"
                onClick={() => onOpen(sim.id)}
              >
                <TableCell className="font-medium">{sim.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {sim.mode === "LICITACAO" ? "Licitação" : "Comercial"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{formatBrl(Number(sim.internalCostTotal))}</TableCell>
                <TableCell className="text-right font-semibold text-[#7C3AED]">
                  {formatBrl(Number(sim.clientPriceTotal))}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {sim.proposalId ? "Gerada" : "—"}
                </TableCell>
                <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() =>
                      deleteMutation.mutate(
                        { id: sim.id },
                        {
                          onSuccess: () => toast.success("Simulação removida"),
                          onError: () => toast.error("Não foi possível remover"),
                        },
                      )
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
