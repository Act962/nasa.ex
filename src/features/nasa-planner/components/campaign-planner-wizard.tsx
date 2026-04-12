"use client";

import { useState } from "react";
import {
  RocketIcon, BuildingIcon, CalendarIcon, ImageIcon,
  CheckSquareIcon, CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon,
  StarIcon, PlusIcon, Trash2Icon, LinkIcon, FolderIcon, SparklesIcon,
  LayoutDashboardIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  useCreateCampaign,
  useCreateCampaignEvent,
  useCreateCampaignTask,
  useCreateCampaignBrandAsset,
} from "../hooks/use-campaign-planner";

const EVENT_TYPES = [
  { value: "TRAINING", label: "Treinamento", emoji: "📚" },
  { value: "STRATEGIC_MEETING", label: "Reunião Estratégica", emoji: "🤝" },
  { value: "KICKOFF", label: "Kickoff", emoji: "🚀" },
  { value: "REVIEW", label: "Review", emoji: "📊" },
  { value: "PRESENTATION", label: "Apresentação", emoji: "🎤" },
  { value: "DEADLINE", label: "Prazo", emoji: "⏰" },
];

const ASSET_TYPES = [
  { value: "LOGO", label: "Logo", emoji: "🎨" },
  { value: "COLOR_PALETTE", label: "Paleta de Cores", emoji: "🎭" },
  { value: "FONT", label: "Fonte", emoji: "✍️" },
  { value: "LINK", label: "Link", emoji: "🔗" },
  { value: "IMAGE", label: "Imagem", emoji: "🖼️" },
  { value: "DOCUMENT", label: "Documento", emoji: "📄" },
];

const CAMPAIGN_TYPES = [
  { value: "captacao",     label: "🎯 Captação de Leads" },
  { value: "vendas",       label: "💰 Vendas Diretas" },
  { value: "trafego",      label: "📈 Tráfego Pago" },
  { value: "lancamento",   label: "🚀 Lançamento de Produto" },
  { value: "retencao",     label: "🔁 Retenção e Fidelização" },
  { value: "marca",        label: "✨ Reconhecimento de Marca" },
  { value: "educativo",    label: "📚 Conteúdo Educativo" },
  { value: "promocao",     label: "🏷️ Promoção / Oferta" },
  { value: "evento",       label: "🎤 Evento / Webinar" },
  { value: "reengajamento",label: "💬 Reengajamento" },
];

const STEPS = [
  { label: "Empresa", icon: BuildingIcon },
  { label: "Plano", icon: RocketIcon },
  { label: "Datas", icon: CalendarIcon },
  { label: "Marca", icon: ImageIcon },
  { label: "Sub-ações", icon: CheckSquareIcon },
  { label: "Confirmação", icon: CheckCircleIcon },
];

interface EventDraft { eventType: string; title: string; scheduledAt: string; durationMinutes: number; meetingLink: string; workspaceId?: string; columnId?: string }
interface TaskDraft { title: string; assignedTo: string; priority: string; dueDate: string; workspaceId?: string; columnId?: string }
interface AssetDraft { assetType: string; name: string; url: string }

interface WizardProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plannerId?: string;
  plannerClientName?: string;
  plannerOrgProjectId?: string;
}

export function CampaignPlannerWizard({ open, onOpenChange, plannerId, plannerClientName, plannerOrgProjectId }: WizardProps) {
  const initialStep = plannerId ? 1 : 0;
  const [step, setStep] = useState(initialStep);
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);

  // Step 0 — Company + Project (only used when no plannerId)
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedOrgName, setSelectedOrgName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [orgOpen, setOrgOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  const { data: integrationsData } = useQuery(
    orpc.platformIntegrations.getMany.queryOptions({ input: {} }),
  );
  const hasGoogleCalendar = (integrationsData?.integrations ?? []).some(
    (i: any) => i.platform === "GOOGLE_CALENDAR" && i.isActive,
  );

  const { data: organizations } = authClient.useListOrganizations();
  const { data: projectsData } = useQuery({
    ...orpc.orgProjects.list.queryOptions({ input: { orgId: selectedOrgId ?? undefined, isActive: true } }),
    enabled: !!selectedOrgId,
  });
  const orgProjects = projectsData?.projects ?? [];
  const selectedProject = orgProjects.find((p: any) => p.id === selectedProjectId);

  // clientName derives from org name or planner's clientOrgName
  const clientName = plannerClientName ?? selectedOrgName;
  // orgProjectId from planner or local selection
  const effectiveProjectId = plannerOrgProjectId ?? selectedProjectId;

  // Step 1 — Plan
  const [campaignType, setCampaignType] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [color, setColor] = useState("#7c3aed");
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);

  // Workspaces (for steps 2 & 4)
  const { data: workspacesData } = useQuery(
    orpc.workspace.list.queryOptions({ input: {} }),
  );
  const workspaces = workspacesData?.workspaces ?? [];

  // Step 3 — Events (Ações)
  const [events, setEvents] = useState<EventDraft[]>([]);
  const [newEvent, setNewEvent] = useState<EventDraft>({ eventType: "KICKOFF", title: "", scheduledAt: "", durationMinutes: 60, meetingLink: "" });

  const { data: eventColumnsData } = useQuery({
    ...orpc.workspace.getColumnsByWorkspace.queryOptions({ input: { workspaceId: newEvent.workspaceId ?? "" } }),
    enabled: !!newEvent.workspaceId,
  });
  const eventColumns = eventColumnsData?.columns ?? [];

  // Step 4 — Brand assets
  const [assets, setAssets] = useState<AssetDraft[]>([]);
  const [newAsset, setNewAsset] = useState<AssetDraft>({ assetType: "LOGO", name: "", url: "" });

  // Step 5 — Tasks (Sub-ações)
  const [tasks, setTasks] = useState<TaskDraft[]>([]);
  const [newTask, setNewTask] = useState<TaskDraft>({ title: "", assignedTo: "", priority: "MEDIUM", dueDate: "" });

  const { data: taskColumnsData } = useQuery({
    ...orpc.workspace.getColumnsByWorkspace.queryOptions({ input: { workspaceId: newTask.workspaceId ?? "" } }),
    enabled: !!newTask.workspaceId,
  });
  const taskColumns = taskColumnsData?.columns ?? [];

  const createCampaign = useCreateCampaign();
  const createEvent = useCreateCampaignEvent();
  const createTask = useCreateCampaignTask();
  const createAsset = useCreateCampaignBrandAsset();

  const generateBriefMutation = useMutation(
    orpc.nasaPlanner.campaigns.generateBrief.mutationOptions(),
  );

  const handleGenerateBrief = async () => {
    if (!campaignType) return;
    setIsGeneratingBrief(true);
    try {
      const result = await generateBriefMutation.mutateAsync({
        campaignType,
        clientName: clientName || undefined,
        projectDescription: (selectedProject as any)?.description || undefined,
        projectSlogan: (selectedProject as any)?.slogan || undefined,
        projectVoiceTone: (selectedProject as any)?.voiceTone || undefined,
        projectPositioning: (selectedProject as any)?.positioning || undefined,
      });
      setDescription(result.description);
    } catch (err: any) {
      // Silently fail — user can type manually
    } finally {
      setIsGeneratingBrief(false);
    }
  };

  const reset = () => {
    setStep(initialStep); setCreatedCampaignId(null);
    setSelectedOrgId(null); setSelectedOrgName(""); setSelectedProjectId(null);
    setCampaignType(""); setTitle(""); setDescription("");
    setStartDate(""); setEndDate(""); setColor("#7c3aed");
    setEvents([]); setAssets([]); setTasks([]);
    setNewEvent({ eventType: "KICKOFF", title: "", scheduledAt: "", durationMinutes: 60, meetingLink: "" });
    setNewAsset({ assetType: "LOGO", name: "", url: "" });
    setNewTask({ title: "", assignedTo: "", priority: "MEDIUM", dueDate: "" });

  };

  const canNext = () => {
    if (step === 0) return plannerId ? true : selectedOrgId !== null;
    if (step === 1) return title.trim().length > 0 && campaignType.length > 0;
    return true;
  };

  const handleNext = async () => {
    if (step === 1 && !createdCampaignId) {
      try {
        const result = await createCampaign.mutateAsync({ title, description, clientName, startDate: startDate || undefined, endDate: endDate || undefined, color, orgProjectId: effectiveProjectId ?? undefined, campaignType: campaignType || undefined, plannerId: plannerId || undefined });
        setCreatedCampaignId(result.campaign.id);
        setStep(2);
      } catch { }
      return;
    }
    // Pre-fill brand from project when entering Step 3
    if (step === 2) prefillBrandFromProject();

    // Auto-save rascunhos ao avançar
    if (step === 2 && newEvent.title && newEvent.scheduledAt) {
      setEvents((e) => [...e, newEvent]);
      setNewEvent({ eventType: "KICKOFF", title: "", scheduledAt: "", durationMinutes: 60, meetingLink: "" });
    }
    if (step === 3 && newAsset.name) {
      setAssets((a) => [...a, newAsset]);
      setNewAsset({ assetType: "LOGO", name: "", url: "" });
    }
    if (step === 4 && newTask.title) {
      setTasks((t) => [...t, newTask]);
      setNewTask({ title: "", assignedTo: "", priority: "MEDIUM", dueDate: "" });
    }
    setStep((s) => s + 1);
  };

  const handleFinish = async () => {
    if (!createdCampaignId) return;

    // Auto-save tarefa ainda no rascunho
    const allTasks = newTask.title ? [...tasks, newTask] : tasks;
    const allEvents = (newEvent.title && newEvent.scheduledAt) ? [...events, newEvent] : events;
    const allAssets = newAsset.name ? [...assets, newAsset] : assets;

    const promises: Promise<any>[] = [];

    for (const ev of allEvents) {
      if (ev.title && ev.scheduledAt) {
        promises.push(createEvent.mutateAsync({ campaignId: createdCampaignId, eventType: ev.eventType as any, title: ev.title, scheduledAt: ev.scheduledAt, durationMinutes: ev.durationMinutes, meetingLink: ev.meetingLink || undefined, workspaceId: ev.workspaceId || undefined, columnId: ev.columnId || undefined }));
      }
    }
    for (const asset of allAssets) {
      if (asset.name) {
        promises.push(createAsset.mutateAsync({ campaignId: createdCampaignId, assetType: asset.assetType as any, name: asset.name, url: asset.url || undefined }));
      }
    }
    for (const task of allTasks) {
      if (task.title) {
        promises.push(createTask.mutateAsync({ campaignId: createdCampaignId, title: task.title, assignedTo: task.assignedTo || undefined, priority: task.priority as any, dueDate: task.dueDate || undefined, workspaceId: task.workspaceId || undefined, columnId: task.columnId || undefined }));
      }
    }

    await Promise.allSettled(promises);
    onOpenChange(false);
    reset();
  };

  const prefillBrandFromProject = () => {
    if (!selectedProject || assets.length > 0) return;
    const p = selectedProject as any;
    const preAssets: AssetDraft[] = [];
    if (p.color) preAssets.push({ assetType: "COLOR_PALETTE", name: `Cor principal: ${p.color}`, url: "" });
    if (p.website) preAssets.push({ assetType: "LINK", name: "Website oficial", url: p.website });
    if (p.slogan) preAssets.push({ assetType: "DOCUMENT", name: `Slogan: ${p.slogan}`, url: "" });
    if (p.voiceTone) preAssets.push({ assetType: "DOCUMENT", name: `Tom de voz: ${p.voiceTone}`, url: "" });
    if (preAssets.length > 0) setAssets(preAssets);
  };

  const addEvent = () => {
    if (!newEvent.title || !newEvent.scheduledAt) return;
    setEvents((e) => [...e, newEvent]);
    setNewEvent({ eventType: "KICKOFF", title: "", scheduledAt: "", durationMinutes: 60, meetingLink: "" });
  };

  const addAsset = () => {
    if (!newAsset.name) return;
    setAssets((a) => [...a, newAsset]);
    setNewAsset({ assetType: "LOGO", name: "", url: "" });
  };

  const addTask = () => {
    if (!newTask.title) return;
    setTasks((t) => [...t, newTask]);
    setNewTask({ title: "", assignedTo: "", priority: "MEDIUM", dueDate: "" });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onOpenChange(false); reset(); } }}>
      <DialogContent className="w-[95vw] max-w-[60rem] max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RocketIcon className="size-5 text-violet-600" />
            Planejar Campanha
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-0.5 py-2 overflow-hidden">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={i} className="flex items-center min-w-0 flex-1">
                <div className={cn(
                  "flex items-center gap-1 text-xs font-medium px-1.5 py-1 rounded-full transition-colors shrink-0",
                  isActive ? "bg-violet-600 text-white" : isDone ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" : "text-muted-foreground"
                )}>
                  <Icon className="size-3 shrink-0" />
                  <span className="hidden sm:block truncate max-w-[4rem]">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={cn("h-px flex-1 mx-0.5 transition-colors min-w-[4px]", isDone ? "bg-violet-300 dark:bg-violet-700" : "bg-border")} />}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="min-h-[300px] space-y-4 py-2">

          {/* Step 0 — Empresa (only shown when no plannerId) */}
          {step === 0 && !plannerId && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">Selecione a empresa e o projeto/cliente para qual esta campanha será criada.</p>

              {/* Org selector */}
              <div className="space-y-1.5">
                <Label>Empresa *</Label>
                <Popover open={orgOpen} onOpenChange={setOrgOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      <div className="flex items-center gap-2 truncate">
                        {selectedOrgName ? (
                          <span className="truncate">{selectedOrgName}</span>
                        ) : (
                          <span className="text-muted-foreground">Selecionar empresa...</span>
                        )}
                      </div>
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
                              <CheckIcon className={cn("size-4", selectedOrgId === org.id ? "opacity-100" : "opacity-0")} />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Project selector — only visible after org selected */}
              {selectedOrgId && (
                <div className="space-y-1.5">
                  <Label>Projeto / Cliente <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                  <Popover open={projectOpen} onOpenChange={setProjectOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        <div className="flex items-center gap-2 truncate">
                          {selectedProject ? (
                            <>
                              <div className="size-3.5 rounded-full shrink-0" style={{ backgroundColor: (selectedProject as any).color ?? "#7c3aed" }} />
                              <span className="truncate">{(selectedProject as any).name}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Selecionar projeto/cliente...</span>
                          )}
                        </div>
                        <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar projeto..." />
                        <CommandList>
                          <CommandEmpty>Nenhum projeto/cliente encontrado.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem value="__none__" onSelect={() => { setSelectedProjectId(null); setProjectOpen(false); }} className="text-muted-foreground">
                              <FolderIcon className="size-4 mr-2 opacity-50" />
                              Nenhum
                            </CommandItem>
                            {orgProjects.map((p: any) => (
                              <CommandItem
                                key={p.id}
                                value={p.name}
                                onSelect={() => { setSelectedProjectId(p.id); setProjectOpen(false); }}
                              >
                                <div className="size-3.5 rounded-full shrink-0 mr-2" style={{ backgroundColor: p.color ?? "#7c3aed" }} />
                                <span className="flex-1 truncate">{p.name}</span>
                                <CheckIcon className={cn("size-4", selectedProjectId === p.id ? "opacity-100" : "opacity-0")} />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          )}

          {/* Step 1 — Plano */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 rounded-lg">
                <StarIcon className="size-4 fill-amber-500 text-amber-500" />
                Esta ação consome <strong>1 STAR</strong>
              </div>

              {/* Campaign type */}
              <div className="space-y-1.5">
                <Label>Tipo de Campanha *</Label>
                <Select value={campaignType} onValueChange={setCampaignType}>
                  <SelectTrigger><SelectValue placeholder="Escolha o tipo de campanha..." /></SelectTrigger>
                  <SelectContent>
                    {CAMPAIGN_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Nome do Planejamento *</Label>
                <Input placeholder="Ex: Campanha Q2 2026 — Lançamento" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Objetivos, contexto e metas</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-7 text-xs text-violet-600 border-violet-200 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                    disabled={!campaignType || isGeneratingBrief}
                    onClick={handleGenerateBrief}
                  >
                    <SparklesIcon className="size-3.5" />
                    {isGeneratingBrief ? "Gerando..." : "Gerar com ASTRO"}
                  </Button>
                </div>
                <Textarea
                  placeholder={campaignType ? "Clique em 'Gerar com ASTRO' ou escreva manualmente..." : "Selecione o tipo de campanha para gerar automaticamente..."}
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Data de Início</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Data de Fim</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Cor da Campanha</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-16 cursor-pointer rounded border" />
                  <span className="text-sm text-muted-foreground">{color}</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Datas estratégicas */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Adicione as ações e datas estratégicas da campanha.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={newEvent.eventType} onValueChange={(v) => setNewEvent((e) => ({ ...e, eventType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.emoji} {t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Data/Hora *</Label>
                  <Input type="datetime-local" value={newEvent.scheduledAt} onChange={(e) => setNewEvent((ev) => ({ ...ev, scheduledAt: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Título *</Label>
                  <Input placeholder="Ex: Reunião de kickoff" value={newEvent.title} onChange={(e) => setNewEvent((ev) => ({ ...ev, title: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Duração (min)</Label>
                  <Input type="number" value={newEvent.durationMinutes} onChange={(e) => setNewEvent((ev) => ({ ...ev, durationMinutes: +e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Link da Reunião</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://meet.google.com/..."
                    value={newEvent.meetingLink}
                    onChange={(e) => setNewEvent((ev) => ({ ...ev, meetingLink: e.target.value }))}
                    className="flex-1"
                  />
                  {hasGoogleCalendar && newEvent.title && newEvent.scheduledAt && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5 text-xs text-[#4285F4] border-[#4285F4]/30 hover:bg-[#4285F4]/10"
                      onClick={() => {
                        const start = new Date(newEvent.scheduledAt);
                        const end = new Date(start.getTime() + newEvent.durationMinutes * 60000);
                        const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
                        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(newEvent.title)}&dates=${fmt(start)}/${fmt(end)}${newEvent.meetingLink ? `&location=${encodeURIComponent(newEvent.meetingLink)}` : ""}`;
                        window.open(url, "_blank");
                      }}
                    >
                      <CalendarIcon className="size-3.5" />
                      Google Calendar
                    </Button>
                  )}
                </div>
                {!hasGoogleCalendar && (
                  <p className="text-xs text-muted-foreground">
                    <a href="/settings/integrations" target="_blank" className="underline text-[#4285F4]">Conecte o Google Calendar</a> para criar eventos diretamente.
                  </p>
                )}
              </div>
              {/* Workspace + Column for event */}
              <div className="border rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                  <LayoutDashboardIcon className="size-3.5" /> Refletir no Workspace <span className="text-[10px]">(opcional)</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={newEvent.workspaceId ?? "__none__"} onValueChange={(v) => setNewEvent((e) => ({ ...e, workspaceId: v === "__none__" ? undefined : v, columnId: undefined }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Workspace" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum</SelectItem>
                      {workspaces.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={newEvent.columnId ?? ""} onValueChange={(v) => setNewEvent((e) => ({ ...e, columnId: v || undefined }))} disabled={!newEvent.workspaceId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status / Coluna" /></SelectTrigger>
                    <SelectContent>
                      {eventColumns.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={addEvent} disabled={!newEvent.title || !newEvent.scheduledAt} className="gap-1">
                <PlusIcon className="size-3.5" /> Adicionar Ação
              </Button>
              {events.length > 0 && (
                <div className="space-y-2">
                  {events.map((ev, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-muted/50 px-3 py-2 rounded-lg">
                      <div>
                        <span className="font-medium">{EVENT_TYPES.find((t) => t.value === ev.eventType)?.emoji} {ev.title}</span>
                        <span className="text-muted-foreground ml-2">{new Date(ev.scheduledAt).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="size-6" onClick={() => setEvents((e) => e.filter((_, j) => j !== i))}>
                        <Trash2Icon className="size-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3 — Materiais de marca */}
          {step === 3 && (
            <div className="space-y-4">
              {selectedProject && (
                <div className="flex items-center gap-2 text-xs text-violet-700 bg-violet-50 dark:bg-violet-950/20 dark:text-violet-300 px-3 py-2 rounded-lg">
                  <div className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: (selectedProject as any).color ?? "#7c3aed" }} />
                  Materiais pré-carregados do projeto <strong>{(selectedProject as any).name}</strong>. Edite ou adicione mais abaixo.
                </div>
              )}
              <p className="text-sm text-muted-foreground">Salve os materiais de identidade visual da campanha.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={newAsset.assetType} onValueChange={(v) => setNewAsset((a) => ({ ...a, assetType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ASSET_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.emoji} {t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Nome *</Label>
                  <Input placeholder="Ex: Logo principal" value={newAsset.name} onChange={(e) => setNewAsset((a) => ({ ...a, name: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><LinkIcon className="size-3.5" /> URL / Link</Label>
                <Input placeholder="https://..." value={newAsset.url} onChange={(e) => setNewAsset((a) => ({ ...a, url: e.target.value }))} />
              </div>
              <Button variant="outline" size="sm" onClick={addAsset} disabled={!newAsset.name} className="gap-1">
                <PlusIcon className="size-3.5" /> Adicionar Material
              </Button>
              {assets.length > 0 && (
                <div className="space-y-2">
                  {assets.map((asset, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-muted/50 px-3 py-2 rounded-lg">
                      <span>{ASSET_TYPES.find((t) => t.value === asset.assetType)?.emoji} <span className="font-medium">{asset.name}</span></span>
                      <Button variant="ghost" size="icon" className="size-6" onClick={() => setAssets((a) => a.filter((_, j) => j !== i))}>
                        <Trash2Icon className="size-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4 — Sub-ações */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Crie as sub-ações iniciais da equipe para esta campanha.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Título da Sub-ação *</Label>
                  <Input placeholder="Ex: Criar artes para redes sociais" value={newTask.title} onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Prioridade</Label>
                  <Select value={newTask.priority} onValueChange={(v) => setNewTask((t) => ({ ...t, priority: v }))}>
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
                  <Input type="date" value={newTask.dueDate} onChange={(e) => setNewTask((t) => ({ ...t, dueDate: e.target.value }))} />
                </div>
              </div>
              {/* Workspace + Column for task */}
              <div className="border rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                  <LayoutDashboardIcon className="size-3.5" /> Refletir no Workspace <span className="text-[10px]">(opcional)</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={newTask.workspaceId ?? "__none__"} onValueChange={(v) => setNewTask((t) => ({ ...t, workspaceId: v === "__none__" ? undefined : v, columnId: undefined }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Workspace" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum</SelectItem>
                      {workspaces.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={newTask.columnId ?? ""} onValueChange={(v) => setNewTask((t) => ({ ...t, columnId: v || undefined }))} disabled={!newTask.workspaceId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status / Coluna" /></SelectTrigger>
                    <SelectContent>
                      {taskColumns.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={addTask} disabled={!newTask.title} className="gap-1">
                <PlusIcon className="size-3.5" /> Adicionar Sub-ação
              </Button>
              {tasks.length > 0 && (
                <div className="space-y-2">
                  {tasks.map((task, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-muted/50 px-3 py-2 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{task.title}</span>
                        <Badge variant="secondary" className="text-xs capitalize">{task.priority.toLowerCase()}</Badge>
                      </div>
                      <Button variant="ghost" size="icon" className="size-6" onClick={() => setTasks((t) => t.filter((_, j) => j !== i))}>
                        <Trash2Icon className="size-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 5 — Confirmação */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold">{title}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BuildingIcon className="size-3.5" />
                  <span>{selectedOrgName}</span>
                  {selectedProject && (
                    <>
                      <span>·</span>
                      <div className="size-2.5 rounded-full" style={{ backgroundColor: (selectedProject as any).color ?? "#7c3aed" }} />
                      <span>{(selectedProject as any).name}</span>
                    </>
                  )}
                </div>
                {(startDate || endDate) && (
                  <p className="text-sm">{startDate && new Date(startDate).toLocaleDateString("pt-BR")} {endDate && `→ ${new Date(endDate).toLocaleDateString("pt-BR")}`}</p>
                )}
                <div className="flex gap-3 flex-wrap">
                  <Badge variant="outline">{events.length} ações</Badge>
                  <Badge variant="outline">{assets.length} materiais</Badge>
                  <Badge variant="outline">{tasks.length} sub-ações</Badge>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Os dados serão salvos e você poderá adicionar mais informações no painel do planejamento.
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2 border-t gap-2 flex-wrap">
          <Button variant="outline" onClick={() => step === 0 ? onOpenChange(false) : setStep((s) => s - 1)} className="gap-1" disabled={createCampaign.isPending}>
            <ChevronLeftIcon className="size-4" />
            {step === 0 ? "Cancelar" : "Anterior"}
          </Button>

          {step < 5 ? (
            <Button onClick={handleNext} disabled={!canNext() || createCampaign.isPending} className="gap-1">
              {createCampaign.isPending ? "Criando..." : (
                <>
                  {step === 1 ? "Criar Planejamento" : "Próximo"}
                  <ChevronRightIcon className="size-4" />
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={createEvent.isPending || createTask.isPending || createAsset.isPending} className="gap-1 bg-violet-600 hover:bg-violet-700">
              <CheckCircleIcon className="size-4" />
              Concluir
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
