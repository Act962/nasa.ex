"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  BrainCircuitIcon,
  FileImageIcon,
  LayoutGridIcon,
  CalendarIcon,
  SettingsIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  CheckCircle2Icon,
  ClockIcon,
  SendIcon,
  MoreVerticalIcon,
  LinkIcon,
  CopyIcon,
  AlertCircleIcon,
  GanttChartIcon,
  NetworkIcon,
  CheckSquareIcon,
  MapIcon,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/spinner";
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
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import {
  useNasaPlanner,
  useUpdatePlanner,
  useNasaPlannerPosts,
  useCreatePlannerPost,
  useDeletePlannerPost,
  useGeneratePlannerPost,
  useApprovePlannerPost,
  useSchedulePlannerPost,
  useNasaPlannerMindMaps,
  useCreateMindMap,
  useDeleteMindMap,
  useNasaPlannerCards,
  useCreateCalendarShare,
} from "../hooks/use-nasa-planner";

// ─── Calendar localizer ────────────────────────────────────────────────────────

const locales = { "pt-BR": ptBR };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: ptBR }),
  getDay,
  locales,
});

// ─── Constants ─────────────────────────────────────────────────────────────────

const POST_STATUSES = [
  { key: "DRAFT", label: "Rascunho", color: "secondary" },
  { key: "PENDING_APPROVAL", label: "Aguardando Aprovação", color: "warning" },
  { key: "APPROVED", label: "Aprovado", color: "default" },
  { key: "SCHEDULED", label: "Agendado", color: "outline" },
  { key: "PUBLISHED", label: "Publicado", color: "default" },
] as const;

const MIND_MAP_TEMPLATES = [
  { key: "mindmap", label: "Mapa Mental", icon: NetworkIcon, description: "Organize ideias de forma visual" },
  { key: "gantt", label: "Gantt", icon: GanttChartIcon, description: "Planejamento de tarefas e prazos" },
  { key: "diagram", label: "Diagrama", icon: MapIcon, description: "Fluxogramas e diagramas" },
  { key: "checklist", label: "Checklist", icon: CheckSquareIcon, description: "Lista de verificação de tarefas" },
] as const;

const POST_TYPES: Record<string, string> = {
  IMAGE: "Imagem",
  VIDEO: "Vídeo",
  CAROUSEL: "Carrossel",
  TEXT: "Texto",
  STORY: "Story",
  REEL: "Reel",
};

const POST_NETWORKS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  LINKEDIN: "LinkedIn",
  TWITTER: "X/Twitter",
  TIKTOK: "TikTok",
};

const CARD_STATUSES: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  TODO: { label: "A Fazer", variant: "secondary" },
  IN_PROGRESS: { label: "Em Andamento", variant: "default" },
  DONE: { label: "Concluído", variant: "outline" },
  CANCELLED: { label: "Cancelado", variant: "secondary" },
};

// ─── Helper components ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Dashboard Tab ─────────────────────────────────────────────────────────────

function DashboardTab({ plannerId }: { plannerId: string }) {
  const { posts } = useNasaPlannerPosts(plannerId);
  const { cards } = useNasaPlannerCards({ plannerId });

  const totalPosts = posts.length;
  const publishedPosts = posts.filter((p: any) => p.status === "PUBLISHED").length;
  const scheduledPosts = posts.filter((p: any) => p.status === "SCHEDULED").length;
  const draftPosts = posts.filter((p: any) => p.status === "DRAFT").length;

  const totalCards = cards.length;
  const pendingCards = cards.filter((c: any) => c.status === "TODO" || c.status === "IN_PROGRESS").length;
  const doneCards = cards.filter((c: any) => c.status === "DONE").length;

  const recentCards = [...cards]
    .sort((a: any, b: any) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Posts</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total de Posts" value={totalPosts} />
          <StatCard label="Publicados" value={publishedPosts} />
          <StatCard label="Agendados" value={scheduledPosts} />
          <StatCard label="Rascunhos" value={draftPosts} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Cards</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Total de Cards" value={totalCards} />
          <StatCard label="Pendentes" value={pendingCards} />
          <StatCard label="Concluídos" value={doneCards} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Atividades Recentes
        </h2>
        {recentCards.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma atividade ainda.</p>
        ) : (
          <div className="space-y-2">
            {recentCards.map((card: any) => {
              const statusInfo = CARD_STATUSES[card.status] ?? CARD_STATUSES["TODO"];
              return (
                <div
                  key={card.id}
                  className="flex items-center justify-between rounded-lg border px-4 py-2.5 bg-card"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant={statusInfo.variant} className="shrink-0 text-xs">
                      {statusInfo.label}
                    </Badge>
                    <span className="text-sm truncate">{card.title}</span>
                  </div>
                  {card.dueDate && (
                    <span className="text-xs text-muted-foreground shrink-0 ml-4">
                      {format(new Date(card.dueDate), "dd/MM/yyyy")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Posts Tab ─────────────────────────────────────────────────────────────────

function PostsTab({ plannerId }: { plannerId: string }) {
  const { posts, isLoading } = useNasaPlannerPosts(plannerId);
  const createPost = useCreatePlannerPost();
  const deletePost = useDeletePlannerPost();
  const generatePost = useGeneratePlannerPost();
  const approvePost = useApprovePlannerPost();
  const schedulePost = useSchedulePlannerPost();

  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [schedulePostId, setSchedulePostId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [newPost, setNewPost] = useState({
    title: "",
    type: "IMAGE",
    networks: [] as string[],
    caption: "",
  });

  const handleCreatePost = async () => {
    if (!newPost.title.trim()) return;
    await createPost.mutateAsync({
      plannerId,
      title: newPost.title,
      type: newPost.type as "STATIC" | "CAROUSEL" | "REEL" | "STORY",
    });
    setCreateOpen(false);
    setNewPost({ title: "", type: "IMAGE", networks: [], caption: "" });
  };

  const handleDelete = async () => {
    if (!deletePostId) return;
    await deletePost.mutateAsync({ postId: deletePostId });
    setDeletePostId(null);
    if (selectedPost?.id === deletePostId) setSelectedPost(null);
  };

  const handleGenerate = async (postId: string) => {
    await generatePost.mutateAsync({ postId, userPrompt: "" });
  };

  const handleApprove = async (postId: string) => {
    await approvePost.mutateAsync({ postId });
  };

  const handleSchedule = async () => {
    if (!schedulePostId || !scheduleDate) return;
    await schedulePost.mutateAsync({ postId: schedulePostId, scheduledAt: new Date(scheduleDate).toISOString() });
    setSchedulePostId(null);
    setScheduleDate("");
  };

  const toggleNetwork = (network: string) => {
    setNewPost((prev) => ({
      ...prev,
      networks: prev.networks.includes(network)
        ? prev.networks.filter((n) => n !== network)
        : [...prev.networks, network],
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <p className="text-sm text-muted-foreground">{posts.length} posts no total</p>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-3.5" />
          Novo Post
        </Button>
      </div>

      {/* Kanban */}
      <ScrollArea className="flex-1">
        <div className="flex gap-4 p-4 min-w-max min-h-full">
          {POST_STATUSES.map((col) => {
            const colPosts = posts.filter((p: any) => p.status === col.key);
            return (
              <div key={col.key} className="w-72 shrink-0 flex flex-col gap-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {col.label}
                  </span>
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 rounded-full">
                    {colPosts.length}
                  </Badge>
                </div>
                <div className="flex flex-col gap-2">
                  {colPosts.map((post: any) => (
                    <Card
                      key={post.id}
                      className="cursor-pointer hover:shadow-sm transition-all border hover:border-violet-300 dark:hover:border-violet-700"
                      onClick={() => setSelectedPost(post)}
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium line-clamp-2 flex-1">{post.title}</p>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVerticalIcon className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGenerate(post.id);
                                }}
                              >
                                <SparklesIcon className="size-3.5 mr-2" />
                                Gerar com IA
                              </DropdownMenuItem>
                              {post.status === "PENDING_APPROVAL" && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApprove(post.id);
                                  }}
                                >
                                  <CheckCircle2Icon className="size-3.5 mr-2" />
                                  Aprovar
                                </DropdownMenuItem>
                              )}
                              {post.status === "APPROVED" && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSchedulePostId(post.id);
                                  }}
                                >
                                  <ClockIcon className="size-3.5 mr-2" />
                                  Agendar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletePostId(post.id);
                                }}
                              >
                                <TrashIcon className="size-3.5 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {post.type && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                              {POST_TYPES[post.type] ?? post.type}
                            </Badge>
                          )}
                          {(post.networks ?? []).map((net: string) => (
                            <Badge key={net} variant="secondary" className="text-xs px-1.5 py-0">
                              {POST_NETWORKS[net] ?? net}
                            </Badge>
                          ))}
                        </div>
                        {post.scheduledAt && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <ClockIcon className="size-3" />
                            {format(new Date(post.scheduledAt), "dd/MM HH:mm")}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {colPosts.length === 0 && (
                    <div className="rounded-lg border border-dashed h-20 flex items-center justify-center">
                      <p className="text-xs text-muted-foreground">Vazio</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Post Detail Dialog */}
      <Dialog open={!!selectedPost} onOpenChange={(o) => !o && setSelectedPost(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="line-clamp-1">{selectedPost?.title}</DialogTitle>
          </DialogHeader>
          {selectedPost && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge>{selectedPost.status}</Badge>
                {selectedPost.type && (
                  <Badge variant="outline">{POST_TYPES[selectedPost.type] ?? selectedPost.type}</Badge>
                )}
                {(selectedPost.networks ?? []).map((net: string) => (
                  <Badge key={net} variant="secondary">{POST_NETWORKS[net] ?? net}</Badge>
                ))}
              </div>
              {selectedPost.caption && (
                <div>
                  <Label className="text-xs text-muted-foreground">Legenda</Label>
                  <ScrollArea className="h-32 mt-1">
                    <p className="text-sm whitespace-pre-wrap">{selectedPost.caption}</p>
                  </ScrollArea>
                </div>
              )}
              {selectedPost.hashtags && (
                <div>
                  <Label className="text-xs text-muted-foreground">Hashtags</Label>
                  <p className="text-sm text-violet-600 dark:text-violet-400 mt-1">{selectedPost.hashtags}</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => handleGenerate(selectedPost.id)}
                  disabled={generatePost.isPending}
                >
                  <SparklesIcon className="size-3.5" />
                  {generatePost.isPending ? "Gerando..." : "Gerar com IA"}
                </Button>
                {selectedPost.status === "PENDING_APPROVAL" && (
                  <Button size="sm" className="gap-1.5" onClick={() => handleApprove(selectedPost.id)}>
                    <CheckCircle2Icon className="size-3.5" />
                    Aprovar
                  </Button>
                )}
                {selectedPost.status === "APPROVED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      setSelectedPost(null);
                      setSchedulePostId(selectedPost.id);
                    }}
                  >
                    <ClockIcon className="size-3.5" />
                    Agendar
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Post Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input
                placeholder="Ex: Post de lançamento do produto X"
                value={newPost.title}
                onChange={(e) => setNewPost((p) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(POST_TYPES).map(([key, label]) => (
                  <Badge
                    key={key}
                    variant={newPost.type === key ? "default" : "outline"}
                    className="cursor-pointer select-none"
                    onClick={() => setNewPost((p) => ({ ...p, type: key }))}
                  >
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Redes Sociais</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(POST_NETWORKS).map(([key, label]) => (
                  <Badge
                    key={key}
                    variant={newPost.networks.includes(key) ? "default" : "outline"}
                    className="cursor-pointer select-none"
                    onClick={() => toggleNetwork(key)}
                  >
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Legenda (opcional)</Label>
              <Textarea
                placeholder="Escreva a legenda do post ou deixe a IA gerar..."
                rows={3}
                value={newPost.caption}
                onChange={(e) => setNewPost((p) => ({ ...p, caption: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreatePost} disabled={!newPost.title.trim() || createPost.isPending}>
              {createPost.isPending ? "Criando..." : "Criar Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={!!schedulePostId} onOpenChange={(o) => !o && setSchedulePostId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Agendar Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Data e Hora</Label>
            <Input
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSchedulePostId(null)}>Cancelar</Button>
            <Button onClick={handleSchedule} disabled={!scheduleDate || schedulePost.isPending}>
              {schedulePost.isPending ? "Agendando..." : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Post Confirm */}
      <AlertDialog open={!!deletePostId} onOpenChange={() => setDeletePostId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Post</AlertDialogTitle>
            <AlertDialogDescription>
              Este post será excluído permanentemente. Deseja continuar?
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

// ─── Mind Maps Tab ─────────────────────────────────────────────────────────────

function MindMapsTab({ plannerId }: { plannerId: string }) {
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
    return (
      <div className="flex items-center justify-center h-48">
        <Spinner size="lg" />
      </div>
    );
  }

  const templateLookup = Object.fromEntries(
    MIND_MAP_TEMPLATES.map((t) => [t.key, t])
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <p className="text-sm text-muted-foreground">{mindMaps.length} mapas mentais</p>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-3.5" />
          Novo Mapa Mental
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
              <PlusIcon className="size-3.5 mr-1.5" />
              Criar Mapa Mental
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
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteMapId(map.id);
                        }}
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
                      {map.updatedAt && (
                        <span>Atualizado {format(new Date(map.updatedAt), "dd/MM/yyyy")}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Create Mind Map Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Mapa Mental</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input
                placeholder="Ex: Estratégia de conteúdo Q2"
                value={mapName}
                onChange={(e) => setMapName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Template</Label>
              <div className="grid grid-cols-2 gap-2">
                {MIND_MAP_TEMPLATES.map(({ key, label, icon: Icon, description }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedTemplate(key)}
                    className={`rounded-lg border p-3 text-left transition-all hover:border-violet-400 ${
                      selectedTemplate === key
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                        : "border-border"
                    }`}
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
            <AlertDialogDescription>
              O mapa mental e todos os seus cards serão excluídos permanentemente. Esta ação não pode ser desfeita.
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

// ─── Calendar Tab ──────────────────────────────────────────────────────────────

function CalendarTab({ plannerId }: { plannerId: string }) {
  const { posts } = useNasaPlannerPosts(plannerId);
  const { cards } = useNasaPlannerCards({ plannerId });
  const createShare = useCreateCalendarShare();

  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  const events = [
    ...posts
      .filter((p: any) => p.scheduledAt || p.publishedAt)
      .map((p: any) => ({
        id: `post-${p.id}`,
        title: `[Post] ${p.title}`,
        start: new Date(p.scheduledAt ?? p.publishedAt),
        end: new Date(p.scheduledAt ?? p.publishedAt),
        resource: { type: "post", data: p },
      })),
    ...cards
      .filter((c: any) => c.dueDate)
      .map((c: any) => ({
        id: `card-${c.id}`,
        title: `[Card] ${c.title}`,
        start: new Date(c.dueDate),
        end: new Date(c.dueDate),
        resource: { type: "card", data: c },
      })),
  ];

  const eventStyleGetter = (event: any) => {
    const isCard = event.resource?.type === "card";
    return {
      style: {
        backgroundColor: isCard ? "#7c3aed" : "#db2777",
        borderRadius: "4px",
        border: "none",
        color: "white",
        fontSize: "12px",
      },
    };
  };

  const handleShare = async () => {
    const result = await createShare.mutateAsync({ plannerId });
    if ((result as any)?.shareUrl) {
      setShareUrl((result as any).shareUrl);
    }
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
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-pink-500 shrink-0" />
            Posts
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-violet-600 shrink-0" />
            Cards
          </span>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={handleShare} disabled={createShare.isPending}>
          <LinkIcon className="size-3.5" />
          {createShare.isPending ? "Gerando..." : "Compartilhar"}
        </Button>
      </div>

      <div className="flex-1 p-4 min-h-0">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: "100%" }}
          culture="pt-BR"
          date={currentDate}
          onNavigate={setCurrentDate}
          eventPropGetter={eventStyleGetter}
          messages={{
            next: "Próximo",
            previous: "Anterior",
            today: "Hoje",
            month: "Mês",
            week: "Semana",
            day: "Dia",
            agenda: "Agenda",
            date: "Data",
            time: "Hora",
            event: "Evento",
            noEventsInRange: "Sem eventos neste período",
          }}
        />
      </div>

      {/* Share Dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link de Compartilhamento</DialogTitle>
          </DialogHeader>
          {shareUrl ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Compartilhe este link para permitir que outros visualizem o calendário.
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
              <AlertCircleIcon className="size-4" />
              Não foi possível gerar o link.
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

// ─── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab({ plannerId }: { plannerId: string }) {
  const { planner, isLoading } = useNasaPlanner(plannerId);
  const updatePlanner = useUpdatePlanner();

  const [form, setForm] = useState({
    brandName: "",
    brandSlogan: "",
    website: "",
    icp: "",
    positioning: "",
    toneOfVoice: "",
    keyMessages: "",
    forbiddenWords: "",
    primaryColors: "",
    secondaryColors: "",
    fonts: "",
    anthropicApiKey: "",
    strengths: "",
    weaknesses: "",
    opportunities: "",
    threats: "",
  });

  useEffect(() => {
    if (planner) {
      setForm({
        brandName: planner.brandName ?? "",
        brandSlogan: planner.brandSlogan ?? "",
        website: planner.website ?? "",
        icp: planner.icp ?? "",
        positioning: planner.positioning ?? "",
        toneOfVoice: planner.toneOfVoice ?? "",
        keyMessages: Array.isArray(planner.keyMessages)
          ? planner.keyMessages.join(", ")
          : planner.keyMessages ?? "",
        forbiddenWords: Array.isArray(planner.forbiddenWords)
          ? planner.forbiddenWords.join(", ")
          : planner.forbiddenWords ?? "",
        primaryColors: Array.isArray(planner.primaryColors)
          ? planner.primaryColors.join(", ")
          : planner.primaryColors ?? "",
        secondaryColors: Array.isArray(planner.secondaryColors)
          ? planner.secondaryColors.join(", ")
          : planner.secondaryColors ?? "",
        fonts: Array.isArray(planner.fonts)
          ? (planner.fonts as string[]).join(", ")
          : (planner.fonts as string) ?? "",
        anthropicApiKey: planner.anthropicApiKey ?? "",
        strengths: (planner as any).strengths ?? "",
        weaknesses: (planner as any).weaknesses ?? "",
        opportunities: (planner as any).opportunities ?? "",
        threats: (planner as any).threats ?? "",
      });
    }
  }, [planner]);

  const handleSave = async () => {
    await updatePlanner.mutateAsync({
      plannerId,
      ...form,
      keyMessages: form.keyMessages
        ? form.keyMessages.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      forbiddenWords: form.forbiddenWords
        ? form.forbiddenWords.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      primaryColors: form.primaryColors
        ? form.primaryColors.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      secondaryColors: form.secondaryColors
        ? form.secondaryColors.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      fonts: form.fonts
        ? form.fonts.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
    });
  };

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 h-full">
      <div className="p-6 space-y-8 max-w-2xl">
        {/* Marca */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Marca</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome da Marca</Label>
              <Input placeholder="Ex: Minha Empresa" {...field("brandName")} />
            </div>
            <div className="space-y-1.5">
              <Label>Slogan</Label>
              <Input placeholder="Ex: Inovando para o futuro" {...field("brandSlogan")} />
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input placeholder="https://minhaempresa.com.br" {...field("website")} />
            </div>
          </div>
        </div>

        <Separator />

        {/* ICP & Posicionamento */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">ICP & Posicionamento</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Perfil do Cliente Ideal (ICP)</Label>
              <Textarea
                placeholder="Descreva o perfil do seu cliente ideal..."
                rows={3}
                {...field("icp")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Posicionamento</Label>
              <Textarea
                placeholder="Como sua marca se posiciona no mercado?"
                rows={3}
                {...field("positioning")}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Voz & Tom */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Voz & Tom</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Tom de Voz</Label>
              <Textarea
                placeholder="Descreva o tom de voz da marca (ex: amigável, profissional, descontraído)..."
                rows={3}
                {...field("toneOfVoice")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Mensagens-chave</Label>
              <Input
                placeholder="Ex: Qualidade, Inovação, Confiança (separadas por vírgula)"
                {...field("keyMessages")}
              />
              <p className="text-xs text-muted-foreground">Separe por vírgula</p>
            </div>
            <div className="space-y-1.5">
              <Label>Palavras Proibidas</Label>
              <Input
                placeholder="Ex: barato, produto, coisa (separadas por vírgula)"
                {...field("forbiddenWords")}
              />
              <p className="text-xs text-muted-foreground">Separe por vírgula</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Visual */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Visual</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Cores Primárias</Label>
              <Input
                placeholder="Ex: #7C3AED, #DB2777 (separadas por vírgula)"
                {...field("primaryColors")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cores Secundárias</Label>
              <Input
                placeholder="Ex: #F3F4F6, #1F2937 (separadas por vírgula)"
                {...field("secondaryColors")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fontes</Label>
              <Input
                placeholder="Ex: Inter, Poppins (separadas por vírgula)"
                {...field("fonts")}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* IA */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Inteligência Artificial</h2>
          <div className="space-y-1.5">
            <Label>Chave de API Anthropic</Label>
            <Input
              type="password"
              placeholder="sk-ant-..."
              {...field("anthropicApiKey")}
            />
            <p className="text-xs text-muted-foreground">
              Usado para geração de conteúdo com IA. Deixe em branco para usar a chave padrão da plataforma.
            </p>
          </div>
        </div>

        <Separator />

        {/* SWOT */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Análise SWOT</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-green-600 dark:text-green-400 font-medium">Forças (Strengths)</Label>
              <Textarea
                placeholder="Pontos fortes da sua marca..."
                rows={4}
                {...field("strengths")}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-red-600 dark:text-red-400 font-medium">Fraquezas (Weaknesses)</Label>
              <Textarea
                placeholder="Pontos fracos a melhorar..."
                rows={4}
                {...field("weaknesses")}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-blue-600 dark:text-blue-400 font-medium">Oportunidades (Opportunities)</Label>
              <Textarea
                placeholder="Oportunidades de mercado..."
                rows={4}
                {...field("opportunities")}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-orange-600 dark:text-orange-400 font-medium">Ameaças (Threats)</Label>
              <Textarea
                placeholder="Ameaças e riscos externos..."
                rows={4}
                {...field("threats")}
              />
            </div>
          </div>
        </div>

        <div className="pt-2 pb-8">
          <Button
            onClick={handleSave}
            disabled={updatePlanner.isPending}
            className="w-full sm:w-auto"
          >
            {updatePlanner.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────

interface NasaPlannerAppProps {
  plannerId: string;
}

export function NasaPlannerApp({ plannerId }: NasaPlannerAppProps) {
  const router = useRouter();
  const { planner, isLoading } = useNasaPlanner(plannerId);
  const [activeTab, setActiveTab] = useState("dashboard");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!planner) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircleIcon className="size-10 text-muted-foreground" />
        <p className="text-muted-foreground">Planner não encontrado.</p>
        <Button variant="outline" onClick={() => router.push("/nasa-planner")}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => router.push("/nasa-planner")}
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <div className="size-8 rounded-lg bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center shrink-0">
          <BrainCircuitIcon className="size-4 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="font-bold text-base leading-tight line-clamp-1">{planner.name}</h1>
          {planner.brandName && (
            <p className="text-xs text-muted-foreground">{planner.brandName}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="border-b px-6 shrink-0">
          <TabsList className="h-10 rounded-none bg-transparent p-0 gap-1">
            <TabsTrigger
              value="dashboard"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-violet-600 data-[state=active]:text-violet-600 data-[state=active]:bg-transparent px-3 py-2 text-sm"
            >
              Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="posts"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-violet-600 data-[state=active]:text-violet-600 data-[state=active]:bg-transparent px-3 py-2 text-sm"
            >
              <FileImageIcon className="size-3.5 mr-1.5" />
              Posts
            </TabsTrigger>
            <TabsTrigger
              value="mindmaps"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-violet-600 data-[state=active]:text-violet-600 data-[state=active]:bg-transparent px-3 py-2 text-sm"
            >
              <LayoutGridIcon className="size-3.5 mr-1.5" />
              Mapas Mentais
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-violet-600 data-[state=active]:text-violet-600 data-[state=active]:bg-transparent px-3 py-2 text-sm"
            >
              <CalendarIcon className="size-3.5 mr-1.5" />
              Calendário
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-violet-600 data-[state=active]:text-violet-600 data-[state=active]:bg-transparent px-3 py-2 text-sm"
            >
              <SettingsIcon className="size-3.5 mr-1.5" />
              Configurações
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="flex-1 min-h-0 overflow-auto mt-0">
          <DashboardTab plannerId={plannerId} />
        </TabsContent>

        <TabsContent value="posts" className="flex-1 min-h-0 overflow-hidden mt-0">
          <PostsTab plannerId={plannerId} />
        </TabsContent>

        <TabsContent value="mindmaps" className="flex-1 min-h-0 overflow-hidden mt-0">
          <MindMapsTab plannerId={plannerId} />
        </TabsContent>

        <TabsContent value="calendar" className="flex-1 min-h-0 overflow-hidden mt-0">
          <CalendarTab plannerId={plannerId} />
        </TabsContent>

        <TabsContent value="settings" className="flex-1 min-h-0 overflow-hidden mt-0">
          <SettingsTab plannerId={plannerId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
