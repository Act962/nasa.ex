"use client";

import { useState } from "react";
import {
  RocketIcon, BuildingIcon, CalendarIcon, ClockIcon, CheckSquareIcon,
  ImageIcon, PlusIcon, Trash2Icon, ExternalLinkIcon, ArrowLeftIcon,
  BadgeCheckIcon, CopyIcon, CheckIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCampaign,
  useCreateCampaignEvent, useDeleteCampaignEvent,
  useCreateCampaignTask, useUpdateCampaignTask,
  useCreateCampaignBrandAsset, useDeleteCampaignBrandAsset,
  useUpdateCampaign,
} from "../hooks/use-campaign-planner";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: "Rascunho",  color: "bg-zinc-500" },
  ACTIVE:    { label: "Ativo",     color: "bg-emerald-500" },
  PAUSED:    { label: "Pausado",   color: "bg-amber-500" },
  COMPLETED: { label: "Concluído", color: "bg-blue-500" },
  ARCHIVED:  { label: "Arquivado", color: "bg-zinc-400" },
};

const EVENT_TYPE_OPTS = [
  { value: "TRAINING", label: "📚 Treinamento" },
  { value: "STRATEGIC_MEETING", label: "🤝 Reunião Estratégica" },
  { value: "KICKOFF", label: "🚀 Kickoff" },
  { value: "REVIEW", label: "📊 Review" },
  { value: "PRESENTATION", label: "🎤 Apresentação" },
  { value: "DEADLINE", label: "⏰ Prazo" },
];

const ASSET_TYPE_OPTS = [
  { value: "LOGO", label: "🎨 Logo" },
  { value: "COLOR_PALETTE", label: "🎭 Paleta" },
  { value: "FONT", label: "✍️ Fonte" },
  { value: "LINK", label: "🔗 Link" },
  { value: "IMAGE", label: "🖼️ Imagem" },
  { value: "DOCUMENT", label: "📄 Documento" },
];

const TASK_STATUS_OPTS = [
  { value: "PENDING", label: "Pendente" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "REVIEW", label: "Revisão" },
  { value: "COMPLETED", label: "Concluído" },
  { value: "BLOCKED", label: "Bloqueado" },
];

export function CampaignDetail({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const { campaign, isLoading } = useCampaign(campaignId);
  const updateCampaign = useUpdateCampaign();
  const createEvent = useCreateCampaignEvent();
  const deleteEvent = useDeleteCampaignEvent();
  const createTask = useCreateCampaignTask();
  const updateTask = useUpdateCampaignTask();
  const createAsset = useCreateCampaignBrandAsset();
  const deleteAsset = useDeleteCampaignBrandAsset();

  const [copied, setCopied] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [assetOpen, setAssetOpen] = useState(false);
  const [eventForm, setEventForm] = useState({ eventType: "KICKOFF", title: "", scheduledAt: "", durationMinutes: 60, meetingLink: "" });
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "MEDIUM", dueDate: "" });
  const [assetForm, setAssetForm] = useState({ assetType: "LOGO", name: "", url: "" });

  const handleCopyCode = () => {
    if (!campaign?.companyCode) return;
    navigator.clipboard.writeText(campaign.companyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Código copiado!");
  };

  const handleAddEvent = async () => {
    if (!eventForm.title || !eventForm.scheduledAt) return;
    await createEvent.mutateAsync({ campaignId, ...eventForm, eventType: eventForm.eventType as any });
    setEventOpen(false);
    setEventForm({ eventType: "KICKOFF", title: "", scheduledAt: "", durationMinutes: 60, meetingLink: "" });
  };

  const handleAddTask = async () => {
    if (!taskForm.title) return;
    await createTask.mutateAsync({ campaignId, ...taskForm, priority: taskForm.priority as any, dueDate: taskForm.dueDate || undefined });
    setTaskOpen(false);
    setTaskForm({ title: "", description: "", priority: "MEDIUM", dueDate: "" });
  };

  const handleAddAsset = async () => {
    if (!assetForm.name) return;
    await createAsset.mutateAsync({ campaignId, assetType: assetForm.assetType as any, name: assetForm.name, url: assetForm.url || undefined });
    setAssetOpen(false);
    setAssetForm({ assetType: "LOGO", name: "", url: "" });
  };

  if (isLoading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-48 w-full" />
    </div>
  );

  if (!campaign) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">Campanha não encontrada.</p>
    </div>
  );

  const statusConf = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.DRAFT;

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1">
            <ArrowLeftIcon className="size-4" /> Voltar
          </Button>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="size-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: campaign.color ?? "#7c3aed" }}>
              <RocketIcon className="size-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">{campaign.title}</h1>
                <div className="flex items-center gap-1">
                  <div className={cn("size-2 rounded-full", statusConf.color)} />
                  <span className="text-sm text-muted-foreground">{statusConf.label}</span>
                </div>
              </div>
              {campaign.clientName && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                  <BuildingIcon className="size-3.5" /> {campaign.clientName}
                </div>
              )}
              {(campaign.startDate || campaign.endDate) && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                  <CalendarIcon className="size-3.5" />
                  {campaign.startDate && new Date(campaign.startDate).toLocaleDateString("pt-BR")}
                  {campaign.endDate && ` → ${new Date(campaign.endDate).toLocaleDateString("pt-BR")}`}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {campaign.companyCode && (
              <div className="flex items-center gap-1.5 border rounded-lg px-3 py-1.5">
                <BadgeCheckIcon className="size-3.5 text-violet-600" />
                <span className="text-sm font-mono font-medium">{campaign.companyCode}</span>
                <Button variant="ghost" size="icon" className="size-5 ml-1" onClick={handleCopyCode}>
                  {copied ? <CheckIcon className="size-3 text-emerald-500" /> : <CopyIcon className="size-3" />}
                </Button>
              </div>
            )}
            <Select value={campaign.status} onValueChange={(v) => updateCampaign.mutateAsync({ campaignId, status: v as any })}>
              <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([v, c]) => (
                  <SelectItem key={v} value={v}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {campaign.publicAccess?.isActive && (
              <Button variant="outline" size="sm" onClick={() => router.push(`/nasa-planner/calendario-cliente?code=${campaign.companyCode}`)} className="gap-1">
                <ExternalLinkIcon className="size-3.5" /> Link cliente
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 px-6 py-4">
        <Tabs defaultValue="events">
          <TabsList className="mb-4">
            <TabsTrigger value="events" className="gap-1.5"><CalendarIcon className="size-3.5" /> Eventos ({campaign.events?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1.5"><CheckSquareIcon className="size-3.5" /> Tarefas ({campaign.tasks?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="brand" className="gap-1.5"><ImageIcon className="size-3.5" /> Marca ({campaign.brandAssets?.length ?? 0})</TabsTrigger>
          </TabsList>

          {/* Events */}
          <TabsContent value="events" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setEventOpen(true)} className="gap-1"><PlusIcon className="size-3.5" /> Adicionar Evento</Button>
            </div>
            {(campaign.events ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento cadastrado.</p>
            ) : (
              <div className="space-y-2">
                {campaign.events.map((ev: any) => (
                  <Card key={ev.id}>
                    <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{ev.title}</span>
                            <Badge variant="secondary" className="text-xs">{EVENT_TYPE_OPTS.find((t) => t.value === ev.eventType)?.label ?? ev.eventType}</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1"><ClockIcon className="size-3" />{new Date(ev.scheduledAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                            <span>{ev.durationMinutes}min</span>
                            {ev.meetingLink && <a href={ev.meetingLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-violet-600 hover:underline" onClick={(e) => e.stopPropagation()}><ExternalLinkIcon className="size-3" />Link</a>}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => deleteEvent.mutateAsync({ campaignId, eventId: ev.id })}>
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tasks */}
          <TabsContent value="tasks" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setTaskOpen(true)} className="gap-1"><PlusIcon className="size-3.5" /> Adicionar Tarefa</Button>
            </div>
            {(campaign.tasks ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tarefa cadastrada.</p>
            ) : (
              <div className="space-y-2">
                {campaign.tasks.map((task: any) => (
                  <Card key={task.id}>
                    <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{task.title}</span>
                          <Badge variant={task.priority === "CRITICAL" ? "destructive" : "secondary"} className="text-xs capitalize">{task.priority.toLowerCase()}</Badge>
                        </div>
                        {task.dueDate && <p className="text-xs text-muted-foreground mt-0.5">Prazo: {new Date(task.dueDate).toLocaleDateString("pt-BR")}</p>}
                      </div>
                      <Select value={task.status} onValueChange={(v) => updateTask.mutateAsync({ campaignId, taskId: task.id, status: v as any })}>
                        <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TASK_STATUS_OPTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Brand assets */}
          <TabsContent value="brand" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setAssetOpen(true)} className="gap-1"><PlusIcon className="size-3.5" /> Adicionar Material</Button>
            </div>
            {(campaign.brandAssets ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum material cadastrado.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {campaign.brandAssets.map((asset: any) => (
                  <Card key={asset.id} className="group">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-sm">{ASSET_TYPE_OPTS.find((t) => t.value === asset.assetType)?.label ?? asset.assetType}</CardTitle>
                        <Button variant="ghost" size="icon" className="size-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive" onClick={() => deleteAsset.mutateAsync({ campaignId, assetId: asset.id })}>
                          <Trash2Icon className="size-3" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-3 px-4">
                      <p className="font-medium text-sm">{asset.name}</p>
                      {asset.url && (
                        <a href={asset.url} target="_blank" rel="noreferrer" className="text-xs text-violet-600 hover:underline flex items-center gap-1 mt-1">
                          <ExternalLinkIcon className="size-3" /> Abrir link
                        </a>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Event Dialog */}
      <Dialog open={eventOpen} onOpenChange={setEventOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Evento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={eventForm.eventType} onValueChange={(v) => setEventForm((f) => ({ ...f, eventType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EVENT_TYPE_OPTS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input value={eventForm.title} onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex: Reunião de kickoff" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data/Hora *</Label>
                <Input type="datetime-local" value={eventForm.scheduledAt} onChange={(e) => setEventForm((f) => ({ ...f, scheduledAt: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Duração (min)</Label>
                <Input type="number" value={eventForm.durationMinutes} onChange={(e) => setEventForm((f) => ({ ...f, durationMinutes: +e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Link da Reunião</Label>
              <Input value={eventForm.meetingLink} onChange={(e) => setEventForm((f) => ({ ...f, meetingLink: e.target.value }))} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddEvent} disabled={!eventForm.title || !eventForm.scheduledAt || createEvent.isPending}>
              {createEvent.isPending ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input value={taskForm.title} onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex: Criar artes para redes sociais" />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea value={taskForm.description} onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select value={taskForm.priority} onValueChange={(v) => setTaskForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">🟢 Baixa</SelectItem>
                    <SelectItem value="MEDIUM">🟡 Média</SelectItem>
                    <SelectItem value="HIGH">🟠 Alta</SelectItem>
                    <SelectItem value="CRITICAL">🔴 Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Prazo</Label>
                <Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddTask} disabled={!taskForm.title || createTask.isPending}>
              {createTask.isPending ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Asset Dialog */}
      <Dialog open={assetOpen} onOpenChange={setAssetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Material de Marca</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={assetForm.assetType} onValueChange={(v) => setAssetForm((f) => ({ ...f, assetType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ASSET_TYPE_OPTS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={assetForm.name} onChange={(e) => setAssetForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Logo principal" />
            </div>
            <div className="space-y-1.5">
              <Label>URL / Link</Label>
              <Input value={assetForm.url} onChange={(e) => setAssetForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssetOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddAsset} disabled={!assetForm.name || createAsset.isPending}>
              {createAsset.isPending ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
