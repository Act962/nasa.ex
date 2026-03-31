"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PlusIcon,
  BrainCircuitIcon,
  FileImageIcon,
  LayoutGridIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useNasaPlanners,
  useCreatePlanner,
  useDeletePlanner,
} from "../hooks/use-nasa-planner";

export function NasaPlannerListPage() {
  const router = useRouter();
  const { planners, isLoading } = useNasaPlanners();
  const createPlanner = useCreatePlanner();
  const deletePlanner = useDeletePlanner();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", brandName: "" });

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    await createPlanner.mutateAsync(form);
    setCreateOpen(false);
    setForm({ name: "", description: "", brandName: "" });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deletePlanner.mutateAsync({ plannerId: deleteId });
    setDeleteId(null);
  };

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center">
            <BrainCircuitIcon className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">NASA PLANNER</h1>
            <p className="text-sm text-muted-foreground">
              Planejamento estratégico de marketing com IA
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <PlusIcon className="size-4" />
          Novo Planner
        </Button>
      </div>

      {/* Grid */}
      <div className="flex-1 p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-52 rounded-xl" />
            ))}
          </div>
        ) : planners.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
              <BrainCircuitIcon className="size-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-lg">Nenhum planner criado</p>
              <p className="text-muted-foreground text-sm mt-1">
                Crie seu primeiro planner de marketing
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <PlusIcon className="size-4" />
              Criar Planner
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {planners.map((planner: any) => (
              <Card
                key={planner.id}
                className="group cursor-pointer hover:shadow-md transition-all border hover:border-violet-300 dark:hover:border-violet-700"
                onClick={() => router.push(`/nasa-planner/${planner.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="size-10 rounded-xl bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center shrink-0">
                      <BrainCircuitIcon className="size-5 text-white" />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(planner.id);
                      }}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                  <CardTitle className="text-base mt-2 line-clamp-1">
                    {planner.name}
                  </CardTitle>
                  {planner.brandName && (
                    <Badge variant="secondary" className="w-fit text-xs">
                      {planner.brandName}
                    </Badge>
                  )}
                  {planner.description && (
                    <CardDescription className="text-xs line-clamp-2">
                      {planner.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileImageIcon className="size-3.5" />
                      {planner._count?.posts ?? 0} posts
                    </span>
                    <span className="flex items-center gap-1">
                      <LayoutGridIcon className="size-3.5" />
                      {planner._count?.mindMaps ?? 0} mapas
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Planner</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do Planner *</Label>
              <Input
                placeholder="Ex: Planner Q1 2026"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nome da Marca</Label>
              <Input
                placeholder="Ex: Minha Empresa Ltda"
                value={form.brandName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, brandName: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descreva os objetivos deste planner..."
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!form.name.trim() || createPlanner.isPending}
            >
              {createPlanner.isPending ? "Criando..." : "Criar Planner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Planner</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os posts e mapas mentais deste planner serão excluídos
              permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
