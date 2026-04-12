"use client";

import { useState } from "react";
import {
  LinkIcon, CheckCircle2Icon, CopyIcon, AlertCircleIcon,
  RocketIcon, FileImageIcon, LayoutGridIcon,
  BuildingIcon, FolderIcon,
} from "lucide-react";
import { Calendar } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useNasaPlannerPosts, useNasaPlannerCards, useCreateCalendarShare,
} from "../../hooks/use-nasa-planner";
import { calendarLocalizer, POST_TYPES } from "../../constants";
import { CampaignPlannerWizard } from "../campaign-planner-wizard";
import { useNasaPlanner } from "../../hooks/use-nasa-planner";

type FilterType = "all" | "campaign" | "post";

export function CalendarTab({ plannerId }: { plannerId: string }) {
  const { planner } = useNasaPlanner(plannerId);
  const { posts } = useNasaPlannerPosts(plannerId);
  const { cards } = useNasaPlannerCards({ plannerId });
  const createShare = useCreateCalendarShare();
  const qc = useQueryClient();

  const [filter, setFilter] = useState<FilterType>("all");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Date click → choose action modal
  const [actionOpen, setActionOpen] = useState(false);
  const [clickedDate, setClickedDate] = useState<Date | null>(null);

  // Campaign wizard
  const [campaignWizardOpen, setCampaignWizardOpen] = useState(false);

  // Create post modal
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [postForm, setPostForm] = useState({
    title: "",
    type: "STATIC",
    orgProjectId: null as string | null,
    clientOrgName: "",
    scheduledAt: "",
  });
  const [orgOpen, setOrgOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const { data: organizations } = authClient.useListOrganizations();
  const { data: projectsData } = useQuery({
    ...orpc.orgProjects.list.queryOptions({ input: { orgId: selectedOrgId ?? undefined, isActive: true } }),
    enabled: !!selectedOrgId,
  });
  const orgProjects = projectsData?.projects ?? [];
  const selectedProject = orgProjects.find((p: any) => p.id === postForm.orgProjectId);

  // Campaigns for this planner
  const { data: campaignsData } = useQuery(
    orpc.nasaPlanner.campaigns.list.queryOptions({ input: { plannerId } }),
  );
  const campaigns = campaignsData?.campaigns ?? [];

  const createPostMutation = useMutation(
    orpc.nasaPlanner.posts.create.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.posts.getMany.key() });
        toast.success("Post criado!");
        setCreatePostOpen(false);
        resetPostForm();
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao criar post"),
    }),
  );

  const resetPostForm = () => {
    setPostForm({ title: "", type: "STATIC", orgProjectId: null, clientOrgName: "", scheduledAt: "" });
    setSelectedOrgId(null);
  };

  // Build events
  const postEvents = posts
    .filter((p: any) => p.scheduledAt || p.publishedAt)
    .map((p: any) => ({
      id: `post-${p.id}`,
      title: `📸 ${p.title ?? "Post"}`,
      start: new Date(p.scheduledAt ?? p.publishedAt),
      end: new Date(p.scheduledAt ?? p.publishedAt),
      resource: { type: "post", data: p },
    }));

  const campaignEvents = campaigns.flatMap((c: any) => {
    const evts = [];
    if (c.startDate) evts.push({
      id: `camp-start-${c.id}`,
      title: `🚀 ${c.title}`,
      start: new Date(c.startDate),
      end: c.endDate ? new Date(c.endDate) : new Date(c.startDate),
      resource: { type: "campaign", data: c },
    });
    return evts;
  });

  const allEvents = [
    ...(filter === "all" || filter === "post" ? postEvents : []),
    ...(filter === "all" || filter === "campaign" ? campaignEvents : []),
  ];

  const eventStyleGetter = (event: any) => {
    const type = event.resource?.type;
    const bg = type === "campaign" ? "#7c3aed" : type === "post" ? "#db2777" : "#6366f1";
    return { style: { backgroundColor: bg, borderRadius: "4px", border: "none", color: "white", fontSize: "12px" } };
  };

  const handleSlotSelect = ({ start }: { start: Date }) => {
    setClickedDate(start);
    setActionOpen(true);
  };

  const handleChooseCampaign = () => {
    setActionOpen(false);
    setCampaignWizardOpen(true);
  };

  const handleChoosePost = () => {
    setActionOpen(false);
    // Pre-fill scheduled date from clicked date
    if (clickedDate) {
      const iso = new Date(clickedDate.getTime() - clickedDate.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setPostForm((f) => ({ ...f, scheduledAt: iso }));
    }
    // Pre-fill org/project from planner if available
    if (planner?.clientOrgName) {
      setPostForm((f) => ({ ...f, clientOrgName: planner.clientOrgName! }));
    }
    if (planner?.orgProjectId) {
      setPostForm((f) => ({ ...f, orgProjectId: planner.orgProjectId! }));
    }
    setCreatePostOpen(true);
  };

  const handleCreatePost = async () => {
    if (!postForm.title.trim()) return;
    await createPostMutation.mutateAsync({
      plannerId,
      title: postForm.title,
      type: postForm.type as any,
      orgProjectId: postForm.orgProjectId ?? undefined,
      clientOrgName: postForm.clientOrgName || undefined,
      scheduledAt: postForm.scheduledAt || undefined,
    });
  };

  const handleShare = async () => {
    const result = await createShare.mutateAsync({ plannerId });
    if ((result as any)?.shareUrl) setShareUrl((result as any).shareUrl);
    setShareOpen(true);
  };

  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0 gap-4 flex-wrap">
        <div className="flex items-center gap-1">
          <Button
            variant={filter === "all" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setFilter("all")}
          >
            <LayoutGridIcon className="size-3.5" />Todos
          </Button>
          <Button
            variant={filter === "campaign" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setFilter("campaign")}
          >
            <RocketIcon className="size-3.5" />Campanhas
          </Button>
          <Button
            variant={filter === "post" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setFilter("post")}
          >
            <FileImageIcon className="size-3.5" />Posts
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-pink-500 shrink-0" />Posts
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-violet-600 shrink-0" />Campanhas
            </span>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleShare} disabled={createShare.isPending}>
            <LinkIcon className="size-3.5" />
            {createShare.isPending ? "Gerando..." : "Compartilhar"}
          </Button>
        </div>
      </div>

      <div className="flex-1 p-4 min-h-0">
        <Calendar
          localizer={calendarLocalizer}
          events={allEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: "100%" }}
          culture="pt-BR"
          date={currentDate}
          onNavigate={setCurrentDate}
          eventPropGetter={eventStyleGetter}
          selectable
          onSelectSlot={handleSlotSelect}
          messages={{
            next: "Próximo", previous: "Anterior", today: "Hoje",
            month: "Mês", week: "Semana", day: "Dia", agenda: "Agenda",
            date: "Data", time: "Hora", event: "Evento",
            noEventsInRange: "Sem eventos neste período",
          }}
        />
      </div>

      {/* Choose action modal */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {clickedDate ? clickedDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "Criar"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">O que deseja criar nesta data?</p>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <button
              onClick={handleChooseCampaign}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-colors"
            >
              <div className="size-10 rounded-xl bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center">
                <RocketIcon className="size-5 text-white" />
              </div>
              <span className="text-sm font-medium">Campanha</span>
            </button>
            <button
              onClick={handleChoosePost}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border hover:border-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/20 transition-colors"
            >
              <div className="size-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                <FileImageIcon className="size-5 text-white" />
              </div>
              <span className="text-sm font-medium">Post</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Post modal */}
      <Dialog open={createPostOpen} onOpenChange={(v) => { setCreatePostOpen(v); if (!v) resetPostForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileImageIcon className="size-4 text-pink-500" />
              Novo Post
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Company */}
            <div className="space-y-1.5">
              <Label>Empresa <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Popover open={orgOpen} onOpenChange={setOrgOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {postForm.clientOrgName ? (
                      <div className="flex items-center gap-2 truncate">
                        <BuildingIcon className="size-3.5 shrink-0 opacity-60" />
                        <span className="truncate">{postForm.clientOrgName}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Selecionar empresa...</span>
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
                              setPostForm((f) => ({ ...f, clientOrgName: org.name, orgProjectId: null }));
                              setOrgOpen(false);
                            }}
                          >
                            <BuildingIcon className="size-4 mr-2 opacity-60" />
                            <span className="flex-1 truncate">{org.name}</span>
                            <CheckIcon className={cn("size-4", postForm.clientOrgName === org.name ? "opacity-100" : "opacity-0")} />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Project */}
            {selectedOrgId && (
              <div className="space-y-1.5">
                <Label>Projeto / Cliente <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Popover open={projectOpen} onOpenChange={setProjectOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      {selectedProject ? (
                        <div className="flex items-center gap-2 truncate">
                          <div className="size-3 rounded-full shrink-0" style={{ backgroundColor: (selectedProject as any).color ?? "#7c3aed" }} />
                          <span className="truncate">{(selectedProject as any).name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Selecionar projeto/cliente...</span>
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
                          <CommandItem value="__none__" onSelect={() => { setPostForm((f) => ({ ...f, orgProjectId: null })); setProjectOpen(false); }} className="text-muted-foreground">
                            <FolderIcon className="size-4 mr-2 opacity-50" /> Nenhum
                          </CommandItem>
                          {orgProjects.map((p: any) => (
                            <CommandItem key={p.id} value={p.name} onSelect={() => { setPostForm((f) => ({ ...f, orgProjectId: p.id })); setProjectOpen(false); }}>
                              <div className="size-3 rounded-full mr-2 shrink-0" style={{ backgroundColor: p.color ?? "#7c3aed" }} />
                              <span className="flex-1 truncate">{p.name}</span>
                              <CheckIcon className={cn("size-4", postForm.orgProjectId === p.id ? "opacity-100" : "opacity-0")} />
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
              <Label>Título *</Label>
              <Input
                placeholder="Ex: Post de lançamento Q2"
                value={postForm.title}
                onChange={(e) => setPostForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={postForm.type} onValueChange={(v) => setPostForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(POST_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Data de publicação</Label>
              <Input
                type="datetime-local"
                value={postForm.scheduledAt}
                onChange={(e) => setPostForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreatePostOpen(false); resetPostForm(); }}>Cancelar</Button>
            <Button
              onClick={handleCreatePost}
              disabled={!postForm.title.trim() || createPostMutation.isPending}
            >
              {createPostMutation.isPending ? "Criando..." : "Criar Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaign Wizard */}
      <CampaignPlannerWizard
        open={campaignWizardOpen}
        onOpenChange={setCampaignWizardOpen}
        plannerId={plannerId}
        plannerClientName={planner?.clientOrgName ?? undefined}
        plannerOrgProjectId={planner?.orgProjectId ?? undefined}
      />

      {/* Share dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Link de Compartilhamento</DialogTitle></DialogHeader>
          {shareUrl ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Compartilhe este link para que outros visualizem o calendário.
              </p>
              <div className="flex items-center gap-2">
                <Input value={shareUrl} readOnly className="text-xs" />
                <Button size="icon" variant="outline" onClick={handleCopy}>
                  {copied ? <CheckCircle2Icon className="size-4" /> : <CopyIcon className="size-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircleIcon className="size-4" />Não foi possível gerar o link.
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShareOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
