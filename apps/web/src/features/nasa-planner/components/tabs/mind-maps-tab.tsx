"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, TrashIcon, NetworkIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNasaPlannerMindMaps, useCreateMindMap, useDeleteMindMap } from "../../hooks/use-nasa-planner";
import { MIND_MAP_TEMPLATES } from "../../constants";

export function MindMapsTab({ plannerId }: { plannerId: string }) {
  const router = useRouter();
  const { mindMaps, isLoading } = useNasaPlannerMindMaps(plannerId);
  const createMindMap = useCreateMindMap();
  const deleteMindMap = useDeleteMindMap();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteMapId, setDeleteMapId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("mindmap");
  const [mapName, setMapName] = useState("");

  const handleCreate = async () => {
    if (!mapName.trim()) return;
    const result = await createMindMap.mutateAsync({
      plannerId,
      name: mapName,
      template: selectedTemplate as "mindmap" | "gantt" | "diagram" | "checklist",
    });
    setCreateOpen(false);
    setMapName("");
    setSelectedTemplate("mindmap");
    if (result?.mindMap?.id) {
      router.push(`/nasa-planner/${plannerId}/mindmap/${result.mindMap.id}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteMapId) return;
    await deleteMindMap.mutateAsync({ mindMapId: deleteMapId });
    setDeleteMapId(null);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>;
  }

  const templateLookup = Object.fromEntries(MIND_MAP_TEMPLATES.map((t) => [t.key, t]));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <p className="text-sm text-muted-foreground">{mindMaps.length} mapas mentais</p>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-3.5" />Novo Mapa Mental
        </Button>
      </div>

      <ScrollArea className="flex-1 p-6">
        {mindMaps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-4">
            <NetworkIcon className="size-10 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">Nenhum mapa mental criado</p>
              <p className="text-sm text-muted-foreground mt-1">Crie seu primeiro mapa para organizar ideias</p>
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <PlusIcon className="size-3.5 mr-1.5" />Criar Mapa Mental
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mindMaps.map((map: any) => {
              const tmpl = templateLookup[map.template] ?? templateLookup["mindmap"];
              const Icon = tmpl.icon;
              return (
                <Card
                  key={map.id}
                  className="group cursor-pointer hover:shadow-md transition-all border hover:border-violet-300 dark:hover:border-violet-700"
                  onClick={() => router.push(`/nasa-planner/${plannerId}/mindmap/${map.id}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="size-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                        <Icon className="size-4.5 text-violet-600 dark:text-violet-400" />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteMapId(map.id); }}
                      >
                        <TrashIcon className="size-3.5" />
                      </Button>
                    </div>
                    <CardTitle className="text-sm mt-2 line-clamp-1">{map.name}</CardTitle>
                    <Badge variant="outline" className="w-fit text-xs">{tmpl.label}</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{map._count?.cards ?? 0} cards</span>
                      {map.updatedAt && <span>Atualizado {format(new Date(map.updatedAt), "dd/MM/yyyy")}</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Mapa Mental</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Ex: Estratégia de conteúdo Q2" value={mapName} onChange={(e) => setMapName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Template</Label>
              <div className="grid grid-cols-2 gap-2">
                {MIND_MAP_TEMPLATES.map(({ key, label, icon: Icon, description }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedTemplate(key)}
                    className={`rounded-lg border p-3 text-left transition-all hover:border-violet-400 ${selectedTemplate === key ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20" : "border-border"}`}
                  >
                    <Icon className="size-5 mb-1.5 text-violet-600 dark:text-violet-400" />
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!mapName.trim() || createMindMap.isPending}>
              {createMindMap.isPending ? "Criando..." : "Criar Mapa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteMapId} onOpenChange={() => setDeleteMapId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Mapa Mental</AlertDialogTitle>
            <AlertDialogDescription>O mapa mental e todos os seus cards serão excluídos permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
