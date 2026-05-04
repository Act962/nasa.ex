"use client";

import { useState } from "react";
import {
  PlusIcon, SparklesIcon, TrashIcon, CheckCircle2Icon,
  ClockIcon, CalendarCheckIcon, CalendarIcon, MoreVerticalIcon, BuildingIcon, FolderIcon, RocketIcon, XIcon, LinkIcon, MegaphoneIcon,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import {
  useNasaPlannerPosts, useCreatePlannerPost, useDeletePlannerPost,
  useGeneratePlannerPost, useApprovePlannerPost, useSchedulePlannerPost,
  usePublishPlannerPost, useUpdatePlannerPost,
} from "../../hooks/use-nasa-planner";
import { EyeIcon, DownloadIcon, ImagePlusIcon, SendIcon, LayersIcon } from "lucide-react";
import { POST_STATUSES, POST_NETWORKS } from "../../constants";
import { ImageEditorDialog } from "../image-editor/image-editor-dialog";
import { VideoEditorDialog } from "../video-editor/video-editor-dialog";
import { VideoIcon } from "lucide-react";
import { PostMediaUploader } from "../post-media-uploader";
import { useNetworkConnectionStatus } from "../../hooks/use-network-status";
import { PostMetricsRow } from "../post-metrics-row";
import { PostPreview } from "../post-preview";
import { PublishTargetPicker } from "../publish-target-picker";

const POST_TYPE_OPTIONS = [
  { value: "STATIC", label: "Imagem" },
  { value: "CAROUSEL", label: "Carrossel" },
  { value: "REEL", label: "Reel" },
  { value: "STORY", label: "Story" },
];

const POST_TYPE_LABELS: Record<string, string> = {
  STATIC: "Imagem", CAROUSEL: "Carrossel", REEL: "Reel", STORY: "Story",
};

export function PostsTab({ plannerId }: { plannerId: string }) {
  const { posts, isLoading } = useNasaPlannerPosts(plannerId);
  const { isConnected } = useNetworkConnectionStatus();
  const createPost = useCreatePlannerPost();
  const deletePost = useDeletePlannerPost();
  const generatePost = useGeneratePlannerPost();
  const approvePost = useApprovePlannerPost();
  const schedulePost = useSchedulePlannerPost();
  const publishPost = usePublishPlannerPost();
  const updatePost = useUpdatePlannerPost();

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);
  const [imageEditorPostId, setImageEditorPostId] = useState<string | null>(null);
  const [videoEditorPostId, setVideoEditorPostId] = useState<string | null>(null);

  // Always derive selectedPost from live posts list so thumbnail updates after generation
  const selectedPost = selectedPostId ? (posts.find((p: any) => p.id === selectedPostId) ?? null) : null;
  const [createOpen, setCreateOpen] = useState(false);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [schedulePostId, setSchedulePostId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");

  // Create post form
  const [newPost, setNewPost] = useState({
    title: "",
    type: "STATIC",
    networks: [] as string[],
    caption: "",
    orgProjectId: null as string | null,
    clientOrgName: "",
    campaignId: null as string | null,
    referenceLinks: [] as string[],
    scheduledAt: "",
    isAd: false,
  });
  const [newLinkInput, setNewLinkInput] = useState("");
  const [orgOpen, setOrgOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const { data: organizations } = authClient.useListOrganizations();

  const { data: projectsData } = useQuery({
    ...orpc.orgProjects.list.queryOptions({ input: { orgId: selectedOrgId ?? undefined, isActive: true } }),
    enabled: !!selectedOrgId,
  });
  const orgProjects = projectsData?.projects ?? [];
  const selectedProject = orgProjects.find((p: any) => p.id === newPost.orgProjectId);

  const { data: campaignsData } = useQuery({
    ...orpc.nasaPlanner.campaigns.list.queryOptions({ input: { plannerId } }),
    enabled: createOpen,
  });
  const campaigns = campaignsData?.campaigns ?? [];
  const selectedCampaign = campaigns.find((c: any) => c.id === newPost.campaignId);

  const resetForm = () => {
    setNewPost({ title: "", type: "STATIC", networks: [], caption: "", orgProjectId: null, clientOrgName: "", campaignId: null, referenceLinks: [], scheduledAt: "", isAd: false });
    setSelectedOrgId(null);
    setNewLinkInput("");
  };

  const addReferenceLink = () => {
    const trimmed = newLinkInput.trim();
    if (!trimmed) return;
    setNewPost((p) => ({ ...p, referenceLinks: [...p.referenceLinks, trimmed] }));
    setNewLinkInput("");
  };

  const removeReferenceLink = (idx: number) =>
    setNewPost((p) => ({ ...p, referenceLinks: p.referenceLinks.filter((_, i) => i !== idx) }));

  const handleCreatePost = async () => {
    if (!newPost.title.trim()) return;
    await createPost.mutateAsync({
      plannerId,
      title: newPost.title,
      type: newPost.type as "STATIC" | "CAROUSEL" | "REEL" | "STORY",
      orgProjectId: newPost.orgProjectId ?? undefined,
      clientOrgName: newPost.clientOrgName || undefined,
      campaignId: newPost.campaignId ?? undefined,
      referenceLinks: newPost.referenceLinks.length ? newPost.referenceLinks : undefined,
      scheduledAt: newPost.scheduledAt || undefined,
      isAd: newPost.isAd,
    });
    setCreateOpen(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (!deletePostId) return;
    await deletePost.mutateAsync({ postId: deletePostId });
    setDeletePostId(null);
    if (selectedPostId === deletePostId) setSelectedPostId(null);
  };

  const getImageUrl = (key: string) =>
    key.startsWith("http") ? key : `https://${process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL}/${key}`;

  const handleDownloadImage = async (key: string, title?: string) => {
    const url = getImageUrl(key);
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      // Force PNG by re-encoding via canvas if needed
      const imgBitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = imgBitmap.width;
      canvas.height = imgBitmap.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(imgBitmap, 0, 0);
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(pngBlob);
        a.download = `${title ?? "post"}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      }, "image/png");
    } catch {
      // Fallback: direct download
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title ?? "post"}.png`;
      a.target = "_blank";
      a.click();
    }
  };

  const handleGenerate = (postId: string) => generatePost.mutateAsync({ postId, userPrompt: "" });
  const handleApprove = (postId: string) => approvePost.mutateAsync({ postId });

  const handleSchedule = async () => {
    if (!schedulePostId || !scheduleDate) return;
    await schedulePost.mutateAsync({ postId: schedulePostId, scheduledAt: new Date(scheduleDate).toISOString() });
    setSchedulePostId(null);
    setScheduleDate("");
  };

  const toggleNetwork = (network: string) =>
    setNewPost((prev) => ({
      ...prev,
      networks: prev.networks.includes(network)
        ? prev.networks.filter((n) => n !== network)
        : [...prev.networks, network],
    }));

  if (isLoading) {
    return <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>;
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

      {/* Kanban board */}
      <ScrollArea className="flex-1">
        <div className="flex gap-4 p-4 min-w-max min-h-full">
          {POST_STATUSES.map((col) => {
            const colPosts = posts.filter((p: any) => p.status === col.key);
            return (
              <div key={col.key} className="w-72 shrink-0 flex flex-col gap-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{col.label}</span>
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 rounded-full">{colPosts.length}</Badge>
                </div>
                <div className="flex flex-col gap-2">
                  {colPosts.map((post: any) => (
                    <Card
                      key={post.id}
                      className="cursor-pointer hover:shadow-sm transition-all border hover:border-violet-300 dark:hover:border-violet-700"
                      onClick={() => setSelectedPostId(post.id)}
                    >
                      <CardContent className="p-3 space-y-2">
                        {post.type === "CAROUSEL" && (post as any).slides?.length > 0 ? (
                          <div className="relative rounded-md overflow-hidden w-full bg-muted">
                            <div className="grid grid-cols-3 gap-0.5">
                              {(post as any).slides.slice(0, 6).map((slide: any, idx: number) => (
                                <div key={slide.id} className="aspect-square bg-muted overflow-hidden">
                                  {slide.imageKey ? (
                                    <img
                                      src={getImageUrl(slide.imageKey)}
                                      alt={`Slide ${idx + 1}`}
                                      className="w-full h-full object-cover"
                                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-muted">
                                      <ImagePlusIcon className="size-4 text-muted-foreground/30" />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] font-medium rounded px-1.5 py-0.5 flex items-center gap-1">
                              <LayersIcon className="size-2.5" />{(post as any).slides.length}
                            </div>
                          </div>
                        ) : post.thumbnail ? (
                          <div className="rounded-md overflow-hidden aspect-square w-full bg-muted">
                            <img
                              src={getImageUrl(post.thumbnail)}
                              alt={post.title ?? "Post"}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                            />
                          </div>
                        ) : (post as any).videoKey ? (
                          <div className="rounded-md aspect-square w-full bg-muted overflow-hidden relative">
                            <video
                              src={getImageUrl((post as any).videoKey)}
                              className="w-full h-full object-cover"
                              muted
                              preload="metadata"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <VideoIcon className="size-8 text-white drop-shadow" />
                            </div>
                          </div>
                        ) : null}
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium line-clamp-2 flex-1">{post.title}</p>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <MoreVerticalIcon className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {post.type !== "REEL" && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setImageEditorPostId(post.id); }}>
                                  <ImagePlusIcon className="size-3.5 mr-2 text-pink-500" />Editar Imagem
                                </DropdownMenuItem>
                              )}
                              {(post.type === "REEL" || !!(post as any).videoKey) && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setVideoEditorPostId(post.id); }}>
                                  <VideoIcon className="size-3.5 mr-2 text-violet-500" />Editar Vídeo
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleGenerate(post.id); }}>
                                <SparklesIcon className="size-3.5 mr-2" />Gerar com IA
                              </DropdownMenuItem>
                              {post.status === "PENDING_APPROVAL" && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleApprove(post.id); }}>
                                  <CheckCircle2Icon className="size-3.5 mr-2" />Aprovar
                                </DropdownMenuItem>
                              )}
                              {post.status === "APPROVED" && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSchedulePostId(post.id); }}>
                                  <ClockIcon className="size-3.5 mr-2" />Agendar
                                </DropdownMenuItem>
                              )}
                              {post.status !== "PUBLISHED" && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); publishPost.mutate({ postId: post.id }); }}>
                                  <SendIcon className="size-3.5 mr-2 text-violet-500" />Publicar Agora
                                </DropdownMenuItem>
                              )}
                              {post.thumbnail && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownloadImage(post.thumbnail!, post.title ?? undefined); }}>
                                  <DownloadIcon className="size-3.5 mr-2" />Baixar Imagem
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
                                  <RocketIcon className="size-3.5 mr-2" />Mover para
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                  {POST_STATUSES.map((s) => (
                                    <DropdownMenuItem
                                      key={s.key}
                                      disabled={post.status === s.key}
                                      onClick={(e) => { e.stopPropagation(); updatePost.mutate({ postId: post.id, status: s.key as any }); }}
                                    >
                                      {post.status === s.key && <CheckIcon className="size-3 mr-2" />}
                                      {post.status !== s.key && <span className="size-3 mr-2" />}
                                      {s.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={(e) => { e.stopPropagation(); setDeletePostId(post.id); }}
                              >
                                <TrashIcon className="size-3.5 mr-2" />Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {post.type && <Badge variant="outline" className="text-xs px-1.5 py-0">{POST_TYPE_LABELS[post.type] ?? post.type}</Badge>}
                          {(post as any).isAd && (
                            <Badge className="text-xs px-1.5 py-0 bg-orange-500 hover:bg-orange-500 text-white gap-1">
                              <MegaphoneIcon className="size-2.5" />Anúncio
                            </Badge>
                          )}
                          {(post.targetNetworks ?? []).map((net: string) => (
                            <Badge key={net} variant="secondary" className="text-xs px-1.5 py-0 gap-1">
                              <span className={`size-1.5 rounded-full shrink-0 ${isConnected(net) ? "bg-emerald-500" : "bg-zinc-400"}`} />
                              {POST_NETWORKS[net] ?? net}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          {post.clientOrgName?.trim() && (
                            <Avatar className="size-5 shrink-0 ring-1 ring-background" title={post.clientOrgName}>
                              <AvatarImage
                                src={(organizations ?? []).find((o: any) => o.name === post.clientOrgName)?.logo ?? ""}
                                alt={post.clientOrgName}
                              />
                              <AvatarFallback className="text-[8px] font-bold bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">
                                {post.clientOrgName.trim()[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          {post.orgProject?.name?.trim() && (
                            <Avatar className="size-5 shrink-0 ring-1 ring-background" title={post.orgProject.name}>
                              <AvatarImage src={post.orgProject.avatar ?? ""} alt={post.orgProject.name} />
                              <AvatarFallback className="text-[8px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                {post.orgProject.name.trim()[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          {post.createdBy && (
                            <Avatar className="size-5 shrink-0 ring-1 ring-background ml-auto" title={post.createdBy.name}>
                              <AvatarImage src={post.createdBy.image ?? ""} alt={post.createdBy.name} />
                              <AvatarFallback className="text-[8px] font-bold">
                                {post.createdBy.name?.[0]?.toUpperCase() ?? "?"}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                        {post.status === "PUBLISHED" && (
                          <PostMetricsRow
                            reach={post.metricsReach}
                            likes={post.metricsLikes}
                            comments={post.metricsComments}
                            videoViews={post.metricsVideoViews}
                          />
                        )}
                        {(() => {
                          if (post.status === "PUBLISHED" && post.publishedAt) {
                            return (
                              <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                <CalendarCheckIcon className="size-3" />
                                Publicado {format(new Date(post.publishedAt), "dd/MM HH:mm")}
                              </p>
                            );
                          }
                          if (post.scheduledAt) {
                            return (
                              <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                <ClockIcon className="size-3" />
                                {format(new Date(post.scheduledAt), "dd/MM HH:mm")}
                              </p>
                            );
                          }
                          return (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <CalendarIcon className="size-3" />
                              {format(new Date(post.createdAt), "dd/MM HH:mm")}
                            </p>
                          );
                        })()}
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

      {/* Post Detail */}
      <Dialog open={!!selectedPost} onOpenChange={(o) => !o && setSelectedPostId(null)}>
        <DialogContent className="max-w-lg max-h-[95vh] sm:max-h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-3 shrink-0 border-b">
            <DialogTitle className="line-clamp-1">{selectedPost?.title}</DialogTitle>
          </DialogHeader>
          {selectedPost && (
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <PostPreview post={selectedPost as any} />
              {selectedPost.thumbnail ? (
                <div className="relative group rounded-lg overflow-hidden aspect-square w-full max-w-xs mx-auto bg-muted">
                  <img
                    src={getImageUrl(selectedPost.thumbnail)}
                    alt={selectedPost.title ?? "Post"}
                    className="w-full h-full object-cover"
                  />
                  {/* Overlay with view/download buttons */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="gap-1.5 shadow-lg"
                      onClick={() => setViewImageUrl(getImageUrl(selectedPost.thumbnail!))}
                    >
                      <EyeIcon className="size-4" />
                      Visualizar
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="gap-1.5 shadow-lg"
                      onClick={() => handleDownloadImage(selectedPost.thumbnail!, selectedPost.title ?? undefined)}
                    >
                      <DownloadIcon className="size-4" />
                      Baixar PNG
                    </Button>
                  </div>
                </div>
              ) : null}

              {/* Media uploader — always visible */}
              <PostMediaUploader
                postId={selectedPost.id}
                postType={selectedPost.type ?? "STATIC"}
                hasImage={!!selectedPost.thumbnail}
                hasVideo={!!(selectedPost as any).videoKey}
                thumbnailUrl={selectedPost.thumbnail}
                slides={(selectedPost as any).slides ?? []}
                onDone={() => setSelectedPostId(selectedPost.id)}
              />

              {/* Action buttons below image */}
              {selectedPost.thumbnail && (
                <div className="flex gap-2 justify-center">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setViewImageUrl(getImageUrl(selectedPost.thumbnail!))}
                  >
                    <EyeIcon className="size-3.5" />
                    Visualizar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => handleDownloadImage(selectedPost.thumbnail!, selectedPost.title ?? undefined)}
                  >
                    <DownloadIcon className="size-3.5" />
                    Baixar PNG
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Badge>{selectedPost.status}</Badge>
                {selectedPost.type && <Badge variant="outline">{POST_TYPE_LABELS[selectedPost.type] ?? selectedPost.type}</Badge>}
                {(selectedPost.targetNetworks ?? []).map((net: string) => (
                  <Badge key={net} variant="secondary">{POST_NETWORKS[net] ?? net}</Badge>
                ))}
              </div>
              {selectedPost.clientOrgName && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <BuildingIcon className="size-3.5" />{selectedPost.clientOrgName}
                </p>
              )}

              <PublishTargetPicker
                targetNetworks={selectedPost.targetNetworks ?? []}
                igAccountId={(selectedPost as any).targetIgAccountId}
                fbPageId={(selectedPost as any).targetFbPageId}
                disabled={updatePost.isPending || selectedPost.status === "PUBLISHED"}
                onChange={(patch) =>
                  updatePost.mutate({ postId: selectedPost.id, ...patch } as any)
                }
              />

              {/* Post para anúncio */}
              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <Label className="flex items-center gap-1.5 cursor-pointer">
                  <MegaphoneIcon className="size-3.5 text-orange-500" />
                  Post para anúncio
                </Label>
                <Switch
                  checked={(selectedPost as any).isAd ?? false}
                  onCheckedChange={(v) => updatePost.mutate({ postId: selectedPost.id, isAd: v })}
                />
              </div>

              {/* Data de publicação — editável */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CalendarIcon className="size-3.5" />Data de Publicação
                </Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="datetime-local"
                    defaultValue={(selectedPost as any).scheduledAt
                      ? new Date((selectedPost as any).scheduledAt).toISOString().slice(0, 16)
                      : ""}
                    key={selectedPost.id}
                    className="flex-1 text-sm"
                    onChange={(e) => {
                      updatePost.mutate({ postId: selectedPost.id, scheduledAt: e.target.value || undefined });
                    }}
                  />
                  {(selectedPost as any).scheduledAt && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => updatePost.mutate({ postId: selectedPost.id, scheduledAt: null })}
                    >
                      <XIcon className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              {selectedPost.caption && (
                <div>
                  <Label className="text-xs text-muted-foreground">Legenda</Label>
                  <ScrollArea className="h-32 mt-1">
                    <p className="text-sm whitespace-pre-wrap">{selectedPost.caption}</p>
                  </ScrollArea>
                </div>
              )}
              {selectedPost.hashtags?.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Hashtags</Label>
                  <p className="text-sm text-violet-600 dark:text-violet-400 mt-1">
                    {Array.isArray(selectedPost.hashtags) ? selectedPost.hashtags.join(" ") : selectedPost.hashtags}
                  </p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleGenerate(selectedPost.id)} disabled={generatePost.isPending}>
                  <SparklesIcon className="size-3.5" />
                  {generatePost.isPending ? "Gerando..." : "Gerar com IA"}
                </Button>
                {selectedPost.status === "PENDING_APPROVAL" && (
                  <Button size="sm" className="gap-1.5" onClick={() => handleApprove(selectedPost.id)}>
                    <CheckCircle2Icon className="size-3.5" />Aprovar
                  </Button>
                )}
                {selectedPost.status === "APPROVED" && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setSelectedPostId(null); setSchedulePostId(selectedPost.id); }}>
                    <ClockIcon className="size-3.5" />Agendar
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Post */}
      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-md max-h-[95vh] sm:max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Post</DialogTitle></DialogHeader>
          <div className="space-y-4">

            {/* Empresa */}
            <div className="space-y-1.5">
              <Label>Empresa <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Popover open={orgOpen} onOpenChange={setOrgOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {newPost.clientOrgName ? (
                      <div className="flex items-center gap-2 truncate">
                        <BuildingIcon className="size-3.5 shrink-0 opacity-60" />
                        <span className="truncate">{newPost.clientOrgName}</span>
                      </div>
                    ) : <span className="text-muted-foreground">Selecionar empresa...</span>}
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
                          <CommandItem key={org.id} value={org.name} onSelect={() => {
                            setSelectedOrgId(org.id);
                            setNewPost((f) => ({ ...f, clientOrgName: org.name, orgProjectId: null }));
                            setOrgOpen(false);
                          }}>
                            <BuildingIcon className="size-4 mr-2 opacity-60" />
                            <span className="flex-1 truncate">{org.name}</span>
                            <CheckIcon className={cn("size-4", newPost.clientOrgName === org.name ? "opacity-100" : "opacity-0")} />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Projeto/Cliente */}
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
                      ) : <span className="text-muted-foreground">Selecionar projeto/cliente...</span>}
                      <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar projeto..." />
                      <CommandList>
                        <CommandEmpty>Nenhum projeto encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem value="__none__" onSelect={() => { setNewPost((f) => ({ ...f, orgProjectId: null, clientOrgName: "" })); setProjectOpen(false); }} className="text-muted-foreground">
                            <FolderIcon className="size-4 mr-2 opacity-50" /> Nenhum
                          </CommandItem>
                          {orgProjects.map((p: any) => (
                            <CommandItem key={p.id} value={p.name} onSelect={() => { setNewPost((f) => ({ ...f, orgProjectId: p.id, clientOrgName: p.name })); setProjectOpen(false); }}>
                              <div className="size-3 rounded-full mr-2 shrink-0" style={{ backgroundColor: p.color ?? "#7c3aed" }} />
                              <span className="flex-1 truncate">{p.name}</span>
                              <CheckIcon className={cn("size-4", newPost.orgProjectId === p.id ? "opacity-100" : "opacity-0")} />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Campanha */}
            <div className="space-y-1.5">
              <Label>Campanha <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Popover open={campaignOpen} onOpenChange={setCampaignOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {selectedCampaign ? (
                      <div className="flex items-center gap-2 truncate">
                        <div className="size-3 rounded-full shrink-0" style={{ backgroundColor: (selectedCampaign as any).color ?? "#7c3aed" }} />
                        <span className="truncate">{(selectedCampaign as any).title}</span>
                      </div>
                    ) : <span className="text-muted-foreground">Vincular a uma campanha...</span>}
                    <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar campanha..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma campanha encontrada.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="__none__" onSelect={() => { setNewPost((f) => ({ ...f, campaignId: null })); setCampaignOpen(false); }} className="text-muted-foreground">
                          <RocketIcon className="size-4 mr-2 opacity-50" /> Nenhuma
                        </CommandItem>
                        {campaigns.map((c: any) => (
                          <CommandItem key={c.id} value={c.title} onSelect={() => { setNewPost((f) => ({ ...f, campaignId: c.id })); setCampaignOpen(false); }}>
                            <div className="size-3 rounded-full mr-2 shrink-0" style={{ backgroundColor: c.color ?? "#7c3aed" }} />
                            <span className="flex-1 truncate">{c.title}</span>
                            <CheckIcon className={cn("size-4", newPost.campaignId === c.id ? "opacity-100" : "opacity-0")} />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input placeholder="Ex: Post de lançamento do produto X" value={newPost.title} onChange={(e) => setNewPost((p) => ({ ...p, title: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <div className="flex flex-wrap gap-2">
                {POST_TYPE_OPTIONS.map(({ value, label }) => (
                  <Badge key={value} variant={newPost.type === value ? "default" : "outline"} className="cursor-pointer select-none" onClick={() => setNewPost((p) => ({ ...p, type: value }))}>{label}</Badge>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Redes Sociais</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(POST_NETWORKS).map(([key, label]) => (
                  <Badge key={key} variant={newPost.networks.includes(key) ? "default" : "outline"} className="cursor-pointer select-none" onClick={() => toggleNetwork(key)}>{label}</Badge>
                ))}
              </div>
            </div>

            {/* Links de Referência */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <LinkIcon className="size-3.5 opacity-60" />
                Links de Referência <span className="text-muted-foreground text-xs">(opcional)</span>
              </Label>
              <p className="text-xs text-muted-foreground">Adicione links de posts do Instagram, Pinterest ou outras redes para usar como inspiração na criação com IA.</p>
              <div className="flex gap-2">
                <Input
                  placeholder="https://www.instagram.com/p/..."
                  value={newLinkInput}
                  onChange={(e) => setNewLinkInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addReferenceLink(); } }}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="sm" onClick={addReferenceLink} disabled={!newLinkInput.trim()}>
                  <PlusIcon className="size-3.5" />
                </Button>
              </div>
              {newPost.referenceLinks.length > 0 && (
                <div className="flex flex-col gap-1 mt-1">
                  {newPost.referenceLinks.map((link, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-xs">
                      <LinkIcon className="size-3 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate text-muted-foreground">{link}</span>
                      <button type="button" onClick={() => removeReferenceLink(idx)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                        <XIcon className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <ClockIcon className="size-3.5 opacity-60" />
                Data e Hora de Publicação <span className="text-muted-foreground text-xs">(opcional)</span>
              </Label>
              <Input
                type="datetime-local"
                value={newPost.scheduledAt}
                onChange={(e) => setNewPost((p) => ({ ...p, scheduledAt: e.target.value }))}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-1.5 cursor-pointer">
                  <MegaphoneIcon className="size-3.5 text-orange-500" />
                  Post para anúncio
                </Label>
                <p className="text-xs text-muted-foreground">Marque se este post será usado como campanha de anúncios pagos.</p>
              </div>
              <Switch
                checked={newPost.isAd}
                onCheckedChange={(v) => setNewPost((p) => ({ ...p, isAd: v }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Legenda (opcional)</Label>
              <Textarea placeholder="Escreva a legenda ou deixe a IA gerar..." rows={3} value={newPost.caption} onChange={(e) => setNewPost((p) => ({ ...p, caption: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleCreatePost} disabled={!newPost.title.trim() || createPost.isPending}>
              {createPost.isPending ? "Criando..." : "Criar Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule */}
      <Dialog open={!!schedulePostId} onOpenChange={(o) => !o && setSchedulePostId(null)}>
        <DialogContent className="max-w-sm max-h-[95vh] sm:max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Agendar Post</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Data e Hora</Label>
            <Input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSchedulePostId(null)}>Cancelar</Button>
            <Button onClick={handleSchedule} disabled={!scheduleDate || schedulePost.isPending}>
              {schedulePost.isPending ? "Agendando..." : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Image Viewer */}
      <Dialog open={!!viewImageUrl} onOpenChange={(o) => !o && setViewImageUrl(null)}>
        <DialogContent className="max-w-2xl max-h-[95vh] sm:max-h-[80vh] p-2 bg-black border-black flex flex-col">
          <DialogHeader className="sr-only">
            <DialogTitle>Visualizar imagem</DialogTitle>
          </DialogHeader>
          {viewImageUrl && (
            <div className="flex flex-col gap-2 flex-1 min-h-0">
              <img
                src={viewImageUrl}
                alt="Post"
                className="flex-1 min-h-0 w-full rounded-md object-contain max-h-[75vh]"
              />
              <div className="flex justify-center gap-2 pb-1">
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1.5"
                  onClick={() => {
                    const key = viewImageUrl.split(`${process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL}/`)[1];
                    if (key) handleDownloadImage(key, selectedPost?.title ?? undefined);
                    else {
                      const a = document.createElement("a");
                      a.href = viewImageUrl;
                      a.download = "post.png";
                      a.target = "_blank";
                      a.click();
                    }
                  }}
                >
                  <DownloadIcon className="size-4" />
                  Baixar PNG (alta qualidade)
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deletePostId} onOpenChange={() => setDeletePostId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Post</AlertDialogTitle>
            <AlertDialogDescription>Este post será excluído permanentemente. Deseja continuar?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Video Editor Dialog */}
      {videoEditorPostId && (() => {
        const vPost = posts.find((p: any) => p.id === videoEditorPostId);
        return (
          <VideoEditorDialog
            open={!!videoEditorPostId}
            onOpenChange={(v) => { if (!v) setVideoEditorPostId(null); }}
            postId={videoEditorPostId}
            postTitle={vPost?.title ?? undefined}
            post={(vPost as any) ?? null}
          />
        );
      })()}

      {/* Image Editor Dialog */}
      {imageEditorPostId && (() => {
        const editorPost = posts.find((p: any) => p.id === imageEditorPostId);
        return (
          <ImageEditorDialog
            open={!!imageEditorPostId}
            onOpenChange={(v) => { if (!v) setImageEditorPostId(null); }}
            postId={imageEditorPostId}
            plannerId={plannerId}
            initialImageKey={editorPost?.thumbnail}
            initialHeadline={editorPost?.slides?.[0]?.headline ?? editorPost?.title ?? null}
            initialSubtext={editorPost?.slides?.[0]?.subtext ?? editorPost?.caption ?? null}
            slides={editorPost?.slides ?? []}
            post={(editorPost as any) ?? null}
          />
        );
      })()}
    </div>
  );
}
