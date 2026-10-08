"use client";

import { useState } from "react";
import {
  RocketIcon,
  BuildingIcon,
  CalendarIcon,
  ImageIcon,
  CheckSquareIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useActiveOrgProjectsByOrg } from "@/features/org-projects/hooks/use-org-projects";
import {
  useGenerateCampaignBrief,
  useCreateCampaign,
  useCreateCampaignEvent,
  useCreateCampaignTask,
  useCreateCampaignBrandAsset,
} from "../hooks/use-campaign-planner";
import { CAMPAIGN_ASSET_TYPE_VALUES, CAMPAIGN_EVENT_TYPE_VALUES, CAMPAIGN_TASK_PRIORITY_VALUES, isOneOf } from "../lib/campaign-options";
import { StepAssets } from "./campaign-wizard/step-assets";
import { StepCompany } from "./campaign-wizard/step-company";
import { StepEvents } from "./campaign-wizard/step-events";
import { StepPlan } from "./campaign-wizard/step-plan";
import { StepReview } from "./campaign-wizard/step-review";
import { StepTasks } from "./campaign-wizard/step-tasks";
import {
  EMPTY_ASSET, EMPTY_EVENT, EMPTY_PLAN, EMPTY_TASK,
  type AssetDraft, type CampaignPlanDraft, type EventDraft, type TaskDraft,
} from "./campaign-wizard/wizard-options";

const STEPS = [
  { label: "Empresa", icon: BuildingIcon },
  { label: "Plano", icon: RocketIcon },
  { label: "Datas", icon: CalendarIcon },
  { label: "Marca", icon: ImageIcon },
  { label: "Sub-ações", icon: CheckSquareIcon },
  { label: "Confirmação", icon: CheckCircleIcon },
];

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

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedOrgName, setSelectedOrgName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const { projects: orgProjects } = useActiveOrgProjectsByOrg(selectedOrgId);
  const selectedProject = orgProjects.find((project) => project.id === selectedProjectId);

  const clientName = plannerClientName ?? selectedOrgName;
  const effectiveProjectId = plannerOrgProjectId ?? selectedProjectId;

  const [plan, setPlan] = useState<CampaignPlanDraft>(EMPTY_PLAN);
  const updatePlan = (patch: Partial<CampaignPlanDraft>) => setPlan((currentPlan) => ({ ...currentPlan, ...patch }));
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);

  const [events, setEvents] = useState<EventDraft[]>([]);
  const [newEvent, setNewEvent] = useState<EventDraft>(EMPTY_EVENT);
  const [assets, setAssets] = useState<AssetDraft[]>([]);
  const [newAsset, setNewAsset] = useState<AssetDraft>(EMPTY_ASSET);
  const [tasks, setTasks] = useState<TaskDraft[]>([]);
  const [newTask, setNewTask] = useState<TaskDraft>(EMPTY_TASK);

  const createCampaign = useCreateCampaign();
  const createEvent = useCreateCampaignEvent();
  const createTask = useCreateCampaignTask();
  const createAsset = useCreateCampaignBrandAsset();
  const generateBriefMutation = useGenerateCampaignBrief();

  const handleGenerateBrief = async () => {
    if (!plan.campaignType) return;
    setIsGeneratingBrief(true);
    try {
      const result = await generateBriefMutation.mutateAsync({
        campaignType: plan.campaignType,
        clientName: clientName || undefined,
        projectDescription: selectedProject?.description || undefined,
        projectSlogan: selectedProject?.slogan || undefined,
        projectVoiceTone: selectedProject?.voiceTone || undefined,
        projectPositioning: selectedProject?.positioning || undefined,
      });
      updatePlan({ description: result.description });
    } catch {
      // Falha silenciosa: dá para escrever o texto na mão.
    } finally {
      setIsGeneratingBrief(false);
    }
  };

  const reset = () => {
    setStep(initialStep); setCreatedCampaignId(null);
    setSelectedOrgId(null); setSelectedOrgName(""); setSelectedProjectId(null);
    setPlan(EMPTY_PLAN);
    setEvents([]); setAssets([]); setTasks([]);
    setNewEvent(EMPTY_EVENT);
    setNewAsset(EMPTY_ASSET);
    setNewTask(EMPTY_TASK);
  };

  const canNext = () => {
    if (step === 0) return plannerId ? true : selectedOrgId !== null;
    if (step === 1) return plan.title.trim().length > 0 && plan.campaignType.length > 0;
    return true;
  };

  const prefillBrandFromProject = () => {
    if (!selectedProject || assets.length > 0) return;
    const preAssets: AssetDraft[] = [];
    if (selectedProject.color) preAssets.push({ assetType: "COLOR_PALETTE", name: `Cor principal: ${selectedProject.color}`, url: "" });
    if (selectedProject.website) preAssets.push({ assetType: "LINK", name: "Website oficial", url: selectedProject.website });
    if (selectedProject.slogan) preAssets.push({ assetType: "DOCUMENT", name: `Slogan: ${selectedProject.slogan}`, url: "" });
    if (selectedProject.voiceTone) preAssets.push({ assetType: "DOCUMENT", name: `Tom de voz: ${selectedProject.voiceTone}`, url: "" });
    if (preAssets.length > 0) setAssets(preAssets);
  };

  const addEvent = () => {
    if (!newEvent.title || !newEvent.scheduledAt) return;
    setEvents((currentEvents) => [...currentEvents, newEvent]);
    setNewEvent(EMPTY_EVENT);
  };

  const addAsset = () => {
    if (!newAsset.name) return;
    setAssets((currentAssets) => [...currentAssets, newAsset]);
    setNewAsset(EMPTY_ASSET);
  };

  const addTask = () => {
    if (!newTask.title) return;
    setTasks((currentTasks) => [...currentTasks, newTask]);
    setNewTask(EMPTY_TASK);
  };

  const handleNext = async () => {
    if (step === 1 && !createdCampaignId) {
      try {
        const result = await createCampaign.mutateAsync({
          title: plan.title,
          description: plan.description,
          clientName,
          startDate: plan.startDate || undefined,
          endDate: plan.endDate || undefined,
          color: plan.color,
          orgProjectId: effectiveProjectId ?? undefined,
          campaignType: plan.campaignType || undefined,
          plannerId: plannerId || undefined,
        });
        setCreatedCampaignId(result.campaign.id);
        setStep(2);
      } catch { }
      return;
    }
    if (step === 2) prefillBrandFromProject();

    // Ao avançar, o rascunho preenchido entra na lista sem precisar clicar em "Adicionar".
    if (step === 2) addEvent();
    if (step === 3) addAsset();
    if (step === 4) addTask();
    setStep((currentStep) => currentStep + 1);
  };

  const handleFinish = async () => {
    if (!createdCampaignId) return;

    const allTasks = newTask.title ? [...tasks, newTask] : tasks;
    const allEvents = (newEvent.title && newEvent.scheduledAt) ? [...events, newEvent] : events;
    const allAssets = newAsset.name ? [...assets, newAsset] : assets;

    const promises: Promise<unknown>[] = [];

    for (const eventDraft of allEvents) {
      const eventType = eventDraft.eventType;
      if (eventDraft.title && eventDraft.scheduledAt && isOneOf(CAMPAIGN_EVENT_TYPE_VALUES, eventType)) {
        promises.push(createEvent.mutateAsync({ campaignId: createdCampaignId, eventType, title: eventDraft.title, scheduledAt: eventDraft.scheduledAt, durationMinutes: eventDraft.durationMinutes, meetingLink: eventDraft.meetingLink || undefined, workspaceId: eventDraft.workspaceId || undefined, columnId: eventDraft.columnId || undefined }));
      }
    }
    for (const assetDraft of allAssets) {
      const assetType = assetDraft.assetType;
      if (assetDraft.name && isOneOf(CAMPAIGN_ASSET_TYPE_VALUES, assetType)) {
        promises.push(createAsset.mutateAsync({ campaignId: createdCampaignId, assetType, name: assetDraft.name, url: assetDraft.url || undefined }));
      }
    }
    for (const taskDraft of allTasks) {
      const priority = taskDraft.priority;
      if (taskDraft.title && isOneOf(CAMPAIGN_TASK_PRIORITY_VALUES, priority)) {
        promises.push(createTask.mutateAsync({ campaignId: createdCampaignId, title: taskDraft.title, assignedTo: taskDraft.assignedTo || undefined, priority, dueDate: taskDraft.dueDate || undefined, workspaceId: taskDraft.workspaceId || undefined, columnId: taskDraft.columnId || undefined }));
      }
    }

    await Promise.allSettled(promises);
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onOpenChange(false); reset(); } }}>
      <DialogContent className="w-[95vw] max-w-[60rem] max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RocketIcon className="size-5 text-info" />
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
                  isActive ? "bg-foreground text-background" : isDone ? "bg-info/15 text-info" : "text-muted-foreground"
                )}>
                  <Icon className="size-3 shrink-0" />
                  <span className="hidden sm:block truncate max-w-[4rem]">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={cn("h-px flex-1 mx-0.5 transition-colors min-w-[4px]", isDone ? "bg-info/40" : "bg-border")} />}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="min-h-[300px] space-y-4 py-2">

          {step === 0 && !plannerId && (
            <StepCompany
              selectedOrgId={selectedOrgId}
              selectedOrgName={selectedOrgName}
              selectedProjectId={selectedProjectId}
              selectedProject={selectedProject}
              orgProjects={orgProjects}
              onSelectOrg={(orgId, orgName) => { setSelectedOrgId(orgId); setSelectedOrgName(orgName); setSelectedProjectId(null); }}
              onSelectProject={setSelectedProjectId}
            />
          )}
          {step === 1 && (
            <StepPlan plan={plan} isGeneratingBrief={isGeneratingBrief} onPlanChange={updatePlan} onGenerateBrief={handleGenerateBrief} />
          )}
          {step === 2 && (
            <StepEvents newEvent={newEvent} setNewEvent={setNewEvent} events={events} setEvents={setEvents} onAddEvent={addEvent} />
          )}
          {step === 3 && (
            <StepAssets selectedProject={selectedProject} newAsset={newAsset} setNewAsset={setNewAsset} assets={assets} setAssets={setAssets} onAddAsset={addAsset} />
          )}
          {step === 4 && (
            <StepTasks newTask={newTask} setNewTask={setNewTask} tasks={tasks} setTasks={setTasks} onAddTask={addTask} />
          )}
          {step === 5 && (
            <StepReview plan={plan} selectedOrgName={selectedOrgName} selectedProject={selectedProject} eventCount={events.length} assetCount={assets.length} taskCount={tasks.length} />
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
            <Button onClick={handleFinish} disabled={createEvent.isPending || createTask.isPending || createAsset.isPending} className="gap-1">
              <CheckCircleIcon className="size-4" />
              Concluir
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
