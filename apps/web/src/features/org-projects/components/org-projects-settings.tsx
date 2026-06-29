"use client";

import { useState } from "react";
import {
  PlusIcon, PencilIcon, Trash2Icon, FolderIcon,
  UsersIcon, BarChart3Icon, LayersIcon, SearchIcon, TagIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useOrgProjects, useDeleteOrgProject } from "../hooks/use-org-projects";
import { ProjectFormDialog } from "./project-form-dialog";
import { ProjectBrandDialog } from "./project-brand-dialog";

const TYPE_LABELS: Record<string, string> = {
  client:   "Cliente",
  project:  "Projeto",
  entity:   "Entidade",
  partner:  "Parceiro",
  supplier: "Fornecedor",
  other:    "Outro",
};

export function OrgProjectsSettings() {
  const { projects, isLoading } = useOrgProjects();
  const deleteProject = useDeleteOrgProject();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [brandProject, setBrandProject] = useState<{ id: string; name: string } | null>(null);

  const filtered = projects.filter((p: any) => p.name.toLowerCase().includes(search.toLowerCase()));

  const handleEdit = (p: any) => { setEditing(p); setFormOpen(true); };
  const handleNew = () => { setEditing(null); setFormOpen(true); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Projetos / Clientes</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organize seus leads, agendamentos, workspaces e planners por projeto ou cliente.
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <PlusIcon className="size-4" /> Novo Projeto/Cliente
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="size-14 rounded-2xl bg-muted flex items-center justify-center">
            <FolderIcon className="size-7 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-semibold">Nenhum projeto/cliente cadastrado</p>
            <p className="text-sm text-muted-foreground mt-1">Crie o primeiro para organizar suas operações.</p>
          </div>
          <Button onClick={handleNew} variant="outline" className="gap-2">
            <PlusIcon className="size-4" /> Criar primeiro
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p: any) => (
            <Card key={p.id} className="group">
              <CardContent className="py-4 px-5 flex items-center gap-4">
                {/* Avatar / color */}
                <div className="size-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm" style={{ backgroundColor: p.color ?? "#7c3aed" }}>
                  {p.avatar ? (
                    <img src={p.avatar} alt={p.name} className="size-10 rounded-xl object-cover" />
                  ) : (
                    p.name.slice(0, 2).toUpperCase()
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{p.name}</span>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {TYPE_LABELS[p.type] ?? p.type}
                    </Badge>
                    {!p.isActive && <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>}
                  </div>
                  {p.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.description}</p>}
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><UsersIcon className="size-3" />{p._count?.leads ?? 0} leads</span>
                    <span className="flex items-center gap-1"><BarChart3Icon className="size-3" />{p._count?.trackings ?? 0} trackings</span>
                    <span className="flex items-center gap-1"><LayersIcon className="size-3" />{p._count?.actions ?? 0} cards</span>
                    <span className="text-muted-foreground/60">{new Date(p.createdAt).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="size-8 text-violet-600" title="Marca" onClick={() => setBrandProject({ id: p.id, name: p.name })}>
                    <TagIcon className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => handleEdit(p)}>
                    <PencilIcon className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)}>
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProjectFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} />

      {brandProject && (
        <ProjectBrandDialog
          open={!!brandProject}
          onOpenChange={(v) => !v && setBrandProject(null)}
          project={brandProject}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar Projeto/Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              O projeto será desativado. Os leads, trackings e cards vinculados serão mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteId) deleteProject.mutateAsync({ projectId: deleteId }); setDeleteId(null); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
