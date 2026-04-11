"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PlusIcon, BrainCircuitIcon, FileImageIcon, LayoutGridIcon,
  Trash2Icon, RocketIcon, BuildingIcon, CalendarIcon, BadgeCheckIcon,
  ClockIcon, ChevronRightIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useNasaPlanners, useCreatePlanner, useDeletePlanner,
} from "../hooks/use-nasa-planner";
import { useCampaigns, useDeleteCampaign } from "../hooks/use-campaign-planner";
import { CampaignPlannerWizard } from "./campaign-planner-wizard";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: "Rascunho",  color: "bg-zinc-500" },
  ACTIVE:    { label: "Ativo",     color: "bg-emerald-500" },
  PAUSED:    { label: "Pausado",   color: "bg-amber-500" },
  COMPLETED: { label: "Concluído", color: "bg-blue-500" },
  ARCHIVED:  { label: "Arquivado", color: "bg-zinc-400" },
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  TRAINING: "Treinamento", STRATEGIC_MEETING: "Reunião", KICKOFF: "Kickoff",
  REVIEW: "Review", PRESENTATION: "Apresentação", DEADLINE: "Prazo",
};

export function NasaPlannerListPage() {
  const router = useRouter();
  const { planners, isLoading } = useNasaPlanners();
  const createPlanner = useCreatePlanner();
  const deletePlanner = useDeletePlanner();
  const { campaigns, isLoading: campaignsLoading } = useCampaigns();
  const deleteCampaign = useDeleteCampaign();

  const [tab, setTab] = useState<"planners" | "campaigns">("planners");
  const [createOpen, setCreateOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteCampaignId, setDeleteCampaignId] = useState<string | null>(null);
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

  const handleDeleteCampaign = async () => {
    if (!deleteCampaignId) return;
    await deleteCampaign.mutateAsync({ campaignId: deleteCampaignId });
    setDeleteCampaignId(null);
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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setWizardOpen(true)} className="gap-2">
            <RocketIcon className="size-4" />
            Planejar Campanha
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <PlusIcon className="size-4" />
            Novo Planner
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="planners" className="gap-1.5">
              <BrainCircuitIcon className="size-3.5" /> Planners
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-1.5">
              <RocketIcon className="size-3.5" /> Campanhas
              {campaigns.length > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-xs">{campaigns.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Grid */}
      <div className="flex-1 p-6">
        {/* Planners tab */}
        {tab === "planners" && (
          isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
            </div>
          ) : planners.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
                <BrainCircuitIcon className="size-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg">Nenhum planner criado</p>
                <p className="text-muted-foreground text-sm mt-1">Crie seu primeiro planner de marketing</p>
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
                        variant="ghost" size="icon"
                        className="size-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteId(planner.id); }}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                    <CardTitle className="text-base mt-2 line-clamp-1">{planner.name}</CardTitle>
                    {planner.brandName && <Badge variant="secondary" className="w-fit text-xs">{planner.brandName}</Badge>}
                    {planner.description && (
                      <CardDescription className="text-xs line-clamp-2">{planner.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><FileImageIcon className="size-3.5" />{planner._count?.posts ?? 0} posts</span>
                      <span className="flex items-center gap-1"><LayoutGridIcon className="size-3.5" />{planner._count?.mindMaps ?? 0} mapas</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}

        {/* Campaigns tab */}
        {tab === "campaigns" && (
          campaignsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
                <RocketIcon className="size-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg">Nenhuma campanha planejada</p>
                <p className="text-muted-foreground text-sm mt-1">Crie seu primeiro planejamento de campanha</p>
              </div>
              <Button onClick={() => setWizardOpen(true)} className="gap-2">
                <RocketIcon className="size-4" /> Planejar Campanha
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-end">
                <Button variant="outline" size="sm" onClick={() => router.push("/nasa-planner/calendario")} className="gap-1.5">
                  <CalendarIcon className="size-3.5" /> Ver Calendário Mestre
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {campaigns.map((campaign: any) => {
                  const statusConf = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.DRAFT;
                  const nextEvent = campaign.events?.[0];
                  const progress = campaign.startDate && campaign.endDate
                    ? Math.min(100, Math.max(0, ((Date.now() - new Date(campaign.startDate).getTime()) / (new Date(campaign.endDate).getTime() - new Date(campaign.startDate).getTime())) * 100))
                    : null;

                  return (
                    <Card
                      key={campaign.id}
                      className="group cursor-pointer hover:shadow-md transition-all border hover:border-violet-300 dark:hover:border-violet-700"
                      onClick={() => router.push(`/nasa-planner/campanhas/${campaign.id}`)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="size-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: campaign.color ?? "#7c3aed" }}>
                            <RocketIcon className="size-5 text-white" />
                          </div>
                          <div className="flex items-center gap-1">
                            <div className={cn("size-2 rounded-full", statusConf.color)} />
                            <span className="text-xs text-muted-foreground">{statusConf.label}</span>
                            <Button
                              variant="ghost" size="icon"
                              className="size-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive ml-1"
                              onClick={(e) => { e.stopPropagation(); setDeleteCampaignId(campaign.id); }}
                            >
                              <Trash2Icon className="size-3" />
                            </Button>
                          </div>
                        </div>
                        <CardTitle className="text-base mt-2 line-clamp-1">{campaign.title}</CardTitle>
                        {campaign.clientName && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <BuildingIcon className="size-3" /> {campaign.clientName}
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {campaign.startDate && campaign.endDate && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{new Date(campaign.startDate).toLocaleDateString("pt-BR")}</span>
                              <span>{new Date(campaign.endDate).toLocaleDateString("pt-BR")}</span>
                            </div>
                            {progress !== null && (
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: campaign.color ?? "#7c3aed" }} />
                              </div>
                            )}
                          </div>
                        )}
                        {nextEvent && (
                          <div className="flex items-center gap-1.5 text-xs bg-muted/50 px-2 py-1.5 rounded-lg">
                            <ClockIcon className="size-3 text-muted-foreground" />
                            <span className="text-muted-foreground">{EVENT_TYPE_LABELS[nextEvent.eventType] ?? nextEvent.eventType}:</span>
                            <span className="font-medium truncate">{nextEvent.title}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex gap-3">
                            <span>{campaign._count?.events ?? 0} eventos</span>
                            <span>{campaign._count?.tasks ?? 0} tarefas</span>
                          </div>
                          {campaign.companyCode && (
                            <Badge variant="outline" className="text-xs font-mono">{campaign.companyCode}</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 text-xs gap-1 px-2"
                            onClick={(e) => { e.stopPropagation(); router.push(`/nasa-planner/campanhas/${campaign.id}`); }}
                          >
                            Ver detalhes <ChevronRightIcon className="size-3" />
                          </Button>
                          {campaign.publicAccess?.isActive && (
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 text-xs gap-1 px-2 text-violet-600"
                              onClick={(e) => { e.stopPropagation(); router.push(`/nasa-planner/calendario-cliente?code=${campaign.companyCode}`); }}
                            >
                              <BadgeCheckIcon className="size-3" /> Link cliente
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>

      {/* Wizard */}
      <CampaignPlannerWizard open={wizardOpen} onOpenChange={setWizardOpen} />

      {/* Create Planner Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Planner</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do Planner *</Label>
              <Input placeholder="Ex: Planner Q1 2026" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Nome da Marca</Label>
              <Input placeholder="Ex: Minha Empresa Ltda" value={form.brandName} onChange={(e) => setForm((f) => ({ ...f, brandName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea placeholder="Descreva os objetivos deste planner..." rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!form.name.trim() || createPlanner.isPending}>
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
            <AlertDialogDescription>Todos os posts e mapas mentais deste planner serão excluídos permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Campaign */}
      <AlertDialog open={!!deleteCampaignId} onOpenChange={() => setDeleteCampaignId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Campanha</AlertDialogTitle>
            <AlertDialogDescription>O planejamento de campanha será arquivado e não aparecerá mais na listagem.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCampaign} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
