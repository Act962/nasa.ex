"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PlusIcon,
  BrainCircuitIcon,
  FileImageIcon,
  LayoutGridIcon,
  Trash2Icon,
  RocketIcon,
  BuildingIcon,
  FolderIcon,
  ChevronRightIcon,
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
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

  // New planner form
  const [form, setForm] = useState({ name: "", description: "" });
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedOrgName, setSelectedOrgName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [orgOpen, setOrgOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  const { data: organizations } = authClient.useListOrganizations();

  const { data: projectsData } = useQuery({
    ...orpc.orgProjects.list.queryOptions({
      input: { orgId: selectedOrgId ?? undefined, isActive: true },
    }),
    enabled: !!selectedOrgId,
  });
  const orgProjects = projectsData?.projects ?? [];
  const selectedProject = orgProjects.find(
    (p: any) => p.id === selectedProjectId,
  );

  const resetForm = () => {
    setForm({ name: "", description: "" });
    setSelectedOrgId(null);
    setSelectedOrgName("");
    setSelectedProjectId(null);
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !selectedOrgId) return;
    await createPlanner.mutateAsync({
      name: form.name,
      description: form.description || undefined,
      clientOrgId: selectedOrgId,
      clientOrgName: selectedOrgName,
      orgProjectId: selectedProjectId ?? undefined,
    });
    setCreateOpen(false);
    resetForm();
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
                Crie seu primeiro planner de marketing associando uma empresa e
                projeto/cliente
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <PlusIcon className="size-4" /> Criar Planner
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

                  {/* Company + Project */}
                  <div className="space-y-1">
                    {planner.clientOrgName && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <BuildingIcon className="size-3 shrink-0" />
                        <span className="truncate">
                          {planner.clientOrgName}
                        </span>
                      </div>
                    )}
                    {planner.orgProject && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div
                          className="size-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              planner.orgProject.color ?? "#7c3aed",
                          }}
                        />
                        <span className="truncate">
                          {planner.orgProject.name}
                        </span>
                      </div>
                    )}
                  </div>

                  {planner.description && (
                    <CardDescription className="text-xs line-clamp-2 mt-1">
                      {planner.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <RocketIcon className="size-3.5" />
                      {planner._count?.campaignPlanners ?? 0} campanhas
                    </span>
                    <span className="flex items-center gap-1">
                      <FileImageIcon className="size-3.5" />
                      {planner._count?.posts ?? 0} posts
                    </span>
                    <span className="flex items-center gap-1">
                      <LayoutGridIcon className="size-3.5" />
                      {planner._count?.mindMaps ?? 0} mapas
                    </span>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <span className="text-xs text-violet-600 flex items-center gap-0.5">
                      Abrir <ChevronRightIcon className="size-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Planner Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Planner</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Company selector */}
            <div className="space-y-1.5">
              <Label>Empresa *</Label>
              <Popover open={orgOpen} onOpenChange={setOrgOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    {selectedOrgName ? (
                      <div className="flex items-center gap-2 truncate">
                        <BuildingIcon className="size-4 shrink-0 opacity-60" />
                        <span className="truncate">{selectedOrgName}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        Selecionar empresa...
                      </span>
                    )}
                    <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar empresa..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                      <CommandGroup>
                        {(organizations ?? []).map((org: any) => (
                          <CommandItem
                            key={org.id}
                            value={org.name}
                            onSelect={() => {
                              setSelectedOrgId(org.id);
                              setSelectedOrgName(org.name);
                              setSelectedProjectId(null);
                              setOrgOpen(false);
                            }}
                          >
                            <BuildingIcon className="size-4 mr-2 opacity-60" />
                            <span className="flex-1 truncate">{org.name}</span>
                            <CheckIcon
                              className={cn(
                                "size-4",
                                selectedOrgId === org.id
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Project selector */}
            {selectedOrgId && (
              <div className="space-y-1.5">
                <Label>
                  Projeto / Cliente{" "}
                  <span className="text-muted-foreground text-xs">
                    (opcional)
                  </span>
                </Label>
                <Popover open={projectOpen} onOpenChange={setProjectOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      {selectedProject ? (
                        <div className="flex items-center gap-2 truncate">
                          <div
                            className="size-3 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                (selectedProject as any).color ?? "#7c3aed",
                            }}
                          />
                          <span className="truncate">
                            {(selectedProject as any).name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          Selecionar projeto/cliente...
                        </span>
                      )}
                      <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar projeto..." />
                      <CommandList>
                        <CommandEmpty>Nenhum projeto encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__none__"
                            onSelect={() => {
                              setSelectedProjectId(null);
                              setProjectOpen(false);
                            }}
                            className="text-muted-foreground"
                          >
                            <FolderIcon className="size-4 mr-2 opacity-50" />{" "}
                            Nenhum
                          </CommandItem>
                          {orgProjects.map((p: any) => (
                            <CommandItem
                              key={p.id}
                              value={p.name}
                              onSelect={() => {
                                setSelectedProjectId(p.id);
                                setProjectOpen(false);
                              }}
                            >
                              <div
                                className="size-3 rounded-full mr-2 shrink-0"
                                style={{
                                  backgroundColor: p.color ?? "#7c3aed",
                                }}
                              />
                              <span className="flex-1 truncate">{p.name}</span>
                              <CheckIcon
                                className={cn(
                                  "size-4",
                                  selectedProjectId === p.id
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Nome do Planner *</Label>
              <Input
                placeholder="Ex: Planner Q2 2026"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descreva os objetivos deste planner..."
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                !form.name.trim() || !selectedOrgId || createPlanner.isPending
              }
            >
              {createPlanner.isPending ? "Criando..." : "Criar Planner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Planner */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Planner</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os posts, mapas mentais e campanhas deste planner serão
              excluídos permanentemente.
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
