"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  SparklesIcon, CheckCircle2Icon, ClockIcon, DownloadIcon,
  EyeIcon, BuildingIcon, XIcon, RocketIcon, TrashIcon,
  CheckIcon, SendIcon, ImagePlusIcon, MegaphoneIcon,
  MoreVerticalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { VideoIcon } from "lucide-react";
import {
  useUpdatePlannerPost, useDeletePlannerPost, useGeneratePlannerPost,
  useApprovePlannerPost, useSchedulePlannerPost, usePublishPlannerPost,
  useSyncPostMetrics,
} from "../hooks/use-nasa-planner";
import { PostMetricsRow } from "./post-metrics-row";
import { RefreshCwIcon } from "lucide-react";
import { POST_STATUSES, POST_NETWORKS } from "../constants";
import { ImageEditorDialog } from "./image-editor/image-editor-dialog";
import { VideoEditorDialog } from "./video-editor/video-editor-dialog";
import { PostMediaUploader } from "./post-media-uploader";
import { PostMetaEditor } from "./post-meta-editor";
import { PostPreview } from "./post-preview";
import { PublishTargetPicker } from "./publish-target-picker";
import type { MenuAction } from "./posts-calendar/types";
import { useNetworkConnectionStatus } from "../hooks/use-network-status";

const POST_TYPE_LABELS: Record<string, string> = {
  STATIC: "Imagem", CAROUSEL: "Carrossel", REEL: "Reel", STORY: "Story",
};

const S3_BASE = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL
  ? `https://${process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL}`
  : "";

function getImageUrl(key: string) {
  return key.startsWith("http") ? key : `${S3_BASE}/${key}`;
}

async function downloadImage(url: string, title?: string) {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const imgBitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = imgBitmap.width;
    canvas.height = imgBitmap.height;
    canvas.getContext("2d")!.drawImage(imgBitmap, 0, 0);
    canvas.toBlob((pngBlob) => {
      if (!pngBlob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(pngBlob);
      a.download = `${title ?? "post"}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  } catch {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title ?? "post"}.png`;
    a.target = "_blank";
    a.click();
  }
}

interface Props {
  post: any | null;
  plannerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAction?: MenuAction | null;
  onInitialActionConsumed?: () => void;
}

export function PostDetailDialog({ post, plannerId, open, onOpenChange, initialAction, onInitialActionConsumed }: Props) {
  const { isConnected } = useNetworkConnectionStatus();
  const syncMetrics = useSyncPostMetrics();
  const updatePost = useUpdatePlannerPost();
  const deletePost = useDeletePlannerPost();
  const generatePost = useGeneratePlannerPost();
  const approvePost = useApprovePlannerPost();
  const schedulePost = useSchedulePlannerPost();
  const publishPost = usePublishPlannerPost();

  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);
  const [imageEditorPostId, setImageEditorPostId] = useState<string | null>(null);
  const [videoEditorPostId, setVideoEditorPostId] = useState<string | null>(null);
  const [schedulePostId, setSchedulePostId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Handle initialAction from 3-dot menu on calendar cards
  useEffect(() => {
    if (!initialAction || !post) return;
    onInitialActionConsumed?.();

    switch (initialAction.type) {
      case "editImage":   setImageEditorPostId(post.id); break;
      case "editVideo":   setVideoEditorPostId(post.id); break;
      case "schedule":    setSchedulePostId(post.id); break;
      case "delete":      setDeleteConfirmId(post.id); break;
      case "generate":    generatePost.mutateAsync({ postId: post.id, userPrompt: "" }); break;
      case "approve":     approvePost.mutateAsync({ postId: post.id }); break;
      case "publish":     publishPost.mutate({ postId: post.id }); break;
      case "download":
        if (post.thumbnail) downloadImage(getImageUrl(post.thumbnail), post.title ?? undefined);
        break;
      case "moveTo":
        updatePost.mutate({ postId: post.id, status: initialAction.status as any });
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAction]);

  const handleSchedule = async () => {
    if (!schedulePostId || !scheduleDate) return;
    await schedulePost.mutateAsync({ postId: schedulePostId, scheduledAt: new Date(scheduleDate).toISOString() });
    setSchedulePostId(null);
    setScheduleDate("");
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deletePost.mutateAsync({ postId: deleteConfirmId });
    setDeleteConfirmId(null);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[95vh] sm:max-h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-3 shrink-0 border-b">
            <div className="flex items-center justify-between gap-2 pr-8">
              <DialogTitle className="line-clamp-1 flex-1">{post?.title}</DialogTitle>
              {post && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-7 shrink-0">
                      <MoreVerticalIcon className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {post.type !== "REEL" && (
                      <DropdownMenuItem onClick={() => setImageEditorPostId(post.id)}>
                        <ImagePlusIcon className="size-3.5 mr-2 text-pink-500" />Editar Imagem
                      </DropdownMenuItem>
                    )}
                    {(post.type === "REEL" || !!post.videoKey) && (
                      <DropdownMenuItem onClick={() => setVideoEditorPostId(post.id)}>
                        <VideoIcon className="size-3.5 mr-2 text-violet-500" />Editar Vídeo
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => generatePost.mutateAsync({ postId: post.id, userPrompt: "" })}>
                      <SparklesIcon className="size-3.5 mr-2" />Gerar com IA
                    </DropdownMenuItem>
                    {post.status === "PENDING_APPROVAL" && (
                      <DropdownMenuItem onClick={() => approvePost.mutateAsync({ postId: post.id })}>
                        <CheckCircle2Icon className="size-3.5 mr-2" />Aprovar
                      </DropdownMenuItem>
                    )}
                    {post.status === "APPROVED" && (
                      <DropdownMenuItem onClick={() => setSchedulePostId(post.id)}>
                        <ClockIcon className="size-3.5 mr-2" />Agendar
                      </DropdownMenuItem>
                    )}
                    {post.status !== "PUBLISHED" && (
                      <DropdownMenuItem onClick={() => publishPost.mutate({ postId: post.id })}>
                        <SendIcon className="size-3.5 mr-2 text-violet-500" />Publicar Agora
                      </DropdownMenuItem>
                    )}
                    {post.thumbnail && (
                      <DropdownMenuItem onClick={() => downloadImage(getImageUrl(post.thumbnail), post.title ?? undefined)}>
                        <DownloadIcon className="size-3.5 mr-2" />Baixar Imagem
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <RocketIcon className="size-3.5 mr-2" />Mover para
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {POST_STATUSES.map((s) => (
                          <DropdownMenuItem
                            key={s.key}
                            disabled={post.status === s.key}
                            onClick={() => updatePost.mutate({ postId: post.id, status: s.key as any })}
                          >
                            {post.status === s.key
                              ? <CheckIcon className="size-3 mr-2" />
                              : <span className="size-3 mr-2 inline-block" />}
                            {s.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteConfirmId(post.id)}
                    >
                      <TrashIcon className="size-3.5 mr-2" />Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </DialogHeader>

          {post && (
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Preview do post (mockup IG) */}
              <PostPreview post={post} />

              {/* Thumbnail */}
              {post.thumbnail ? (
                <div className="relative group rounded-lg overflow-hidden aspect-square w-full max-w-xs mx-auto bg-muted">
                  <img
                    src={getImageUrl(post.thumbnail)}
                    alt={post.title ?? "Post"}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <Button size="sm" variant="secondary" className="gap-1.5 shadow-lg"
                      onClick={() => setViewImageUrl(getImageUrl(post.thumbnail))}>
                      <EyeIcon className="size-4" />Visualizar
                    </Button>
                    <Button size="sm" variant="secondary" className="gap-1.5 shadow-lg"
                      onClick={() => downloadImage(getImageUrl(post.thumbnail), post.title ?? undefined)}>
                      <DownloadIcon className="size-4" />Baixar PNG
                    </Button>
                  </div>
                </div>
              ) : null}

              {/* Media uploader */}
              <PostMediaUploader
                postId={post.id}
                postType={post.type ?? "STATIC"}
                hasImage={!!post.thumbnail}
                hasVideo={!!post.videoKey}
                thumbnailUrl={post.thumbnail}
                slides={post.slides ?? []}
                onDone={() => {}}
              />

              {post.thumbnail && (
                <div className="flex gap-2 justify-center">
                  <Button size="sm" variant="outline" className="gap-1.5"
                    onClick={() => setViewImageUrl(getImageUrl(post.thumbnail))}>
                    <EyeIcon className="size-3.5" />Visualizar
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5"
                    onClick={() => downloadImage(getImageUrl(post.thumbnail), post.title ?? undefined)}>
                    <DownloadIcon className="size-3.5" />Baixar PNG
                  </Button>
                </div>
              )}

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <Badge>{post.status}</Badge>
                {post.type && <Badge variant="outline">{POST_TYPE_LABELS[post.type] ?? post.type}</Badge>}
                {(post.targetNetworks ?? []).map((net: string) => (
                  <Badge key={net} variant="secondary" className="gap-1">
                    <span className={`size-1.5 rounded-full shrink-0 ${isConnected(net) ? "bg-emerald-500" : "bg-zinc-400"}`} />
                    {POST_NETWORKS[net] ?? net}
                  </Badge>
                ))}
                {post.isAd && (
                  <Badge className="bg-orange-500 hover:bg-orange-500 text-white gap-1">
                    <MegaphoneIcon className="size-2.5" />Anúncio
                  </Badge>
                )}
              </div>

              {post.clientOrgName && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <BuildingIcon className="size-3.5" />{post.clientOrgName}
                </p>
              )}

              {/* Onde publicar */}
              <PublishTargetPicker
                targetNetworks={post.targetNetworks ?? []}
                igAccountId={post.targetIgAccountId}
                fbPageId={post.targetFbPageId}
                disabled={updatePost.isPending || post.status === "PUBLISHED"}
                onChange={(patch) =>
                  updatePost.mutate({ postId: post.id, ...patch } as any)
                }
              />

              {post.status === "PUBLISHED" && (post.externalIgPostId || post.externalFbPostId) && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Desempenho</Label>
                    <Button
                      size="sm" variant="ghost" className="h-6 text-xs gap-1"
                      onClick={() => syncMetrics.mutate({ postId: post.id })}
                      disabled={syncMetrics.isPending}
                    >
                      <RefreshCwIcon className={`size-3 ${syncMetrics.isPending ? "animate-spin" : ""}`} />
                      Sincronizar
                    </Button>
                  </div>
                  <PostMetricsRow
                    size="md"
                    reach={post.metricsReach}
                    impressions={post.metricsImpressions}
                    likes={post.metricsLikes}
                    comments={post.metricsComments}
                    shares={post.metricsShares}
                    videoViews={post.metricsVideoViews}
                  />
                  {!post.metricsSyncedAt && !post.metricsSyncError && (
                    <p className="text-[11px] text-muted-foreground">Sem dados ainda — clique em Sincronizar.</p>
                  )}
                  {post.metricsSyncedAt && (
                    <p className="text-[11px] text-muted-foreground">
                      Atualizado {format(new Date(post.metricsSyncedAt), "dd/MM HH:mm")}
                    </p>
                  )}
                  {post.metricsSyncError && (
                    <p className="text-[11px] text-destructive">⚠ {post.metricsSyncError}</p>
                  )}
                </div>
              )}

              {/* PostMetaEditor: empresa, projeto, data, isAd */}
              <PostMetaEditor post={post} />

              {/* Caption */}
              {post.caption && (
                <div>
                  <Label className="text-xs text-muted-foreground">Legenda</Label>
                  <ScrollArea className="h-32 mt-1">
                    <p className="text-sm whitespace-pre-wrap">{post.caption}</p>
                  </ScrollArea>
                </div>
              )}

              {/* Hashtags */}
              {post.hashtags?.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Hashtags</Label>
                  <p className="text-sm text-violet-600 dark:text-violet-400 mt-1">
                    {Array.isArray(post.hashtags) ? post.hashtags.join(" ") : post.hashtags}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-2 pb-2">
                <Button size="sm" variant="outline" className="gap-1.5"
                  onClick={() => generatePost.mutateAsync({ postId: post.id, userPrompt: "" })}
                  disabled={generatePost.isPending}>
                  <SparklesIcon className="size-3.5" />
                  {generatePost.isPending ? "Gerando..." : "Gerar com IA"}
                </Button>
                {post.status === "PENDING_APPROVAL" && (
                  <Button size="sm" className="gap-1.5"
                    onClick={() => approvePost.mutateAsync({ postId: post.id })}>
                    <CheckCircle2Icon className="size-3.5" />Aprovar
                  </Button>
                )}
                {post.status === "APPROVED" && (
                  <Button size="sm" variant="outline" className="gap-1.5"
                    onClick={() => setSchedulePostId(post.id)}>
                    <ClockIcon className="size-3.5" />Agendar
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Schedule dialog */}
      <Dialog open={!!schedulePostId} onOpenChange={(o) => !o && setSchedulePostId(null)}>
        <DialogContent className="max-w-sm">
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

      {/* Fullscreen image viewer */}
      <Dialog open={!!viewImageUrl} onOpenChange={(o) => !o && setViewImageUrl(null)}>
        <DialogContent className="max-w-2xl max-h-[95vh] p-2 bg-black border-black flex flex-col">
          <DialogHeader className="sr-only"><DialogTitle>Visualizar imagem</DialogTitle></DialogHeader>
          {viewImageUrl && (
            <div className="flex flex-col gap-2 flex-1 min-h-0">
              <img src={viewImageUrl} alt="Post" className="flex-1 min-h-0 w-full rounded-md object-contain max-h-[75vh]" />
              <div className="flex justify-center pb-1">
                <Button size="sm" variant="secondary" className="gap-1.5"
                  onClick={() => {
                    const key = viewImageUrl.split(`${process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL}/`)[1];
                    if (key) downloadImage(getImageUrl(key), post?.title ?? undefined);
                    else { const a = document.createElement("a"); a.href = viewImageUrl; a.download = "post.png"; a.target = "_blank"; a.click(); }
                  }}>
                  <DownloadIcon className="size-4" />Baixar PNG
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Post</AlertDialogTitle>
            <AlertDialogDescription>Este post será excluído permanentemente. Deseja continuar?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image editor */}
      {imageEditorPostId && (
        <ImageEditorDialog
          open={!!imageEditorPostId}
          onOpenChange={(v) => { if (!v) setImageEditorPostId(null); }}
          postId={imageEditorPostId}
          plannerId={plannerId}
          initialImageKey={post?.thumbnail}
          initialHeadline={post?.slides?.[0]?.headline ?? post?.title ?? null}
          initialSubtext={post?.slides?.[0]?.subtext ?? post?.caption ?? null}
          slides={post?.slides ?? []}
          post={post}
        />
      )}

      {/* Video editor */}
      {videoEditorPostId && (
        <VideoEditorDialog
          open={!!videoEditorPostId}
          onOpenChange={(v) => { if (!v) setVideoEditorPostId(null); }}
          postId={videoEditorPostId}
          postTitle={post?.title ?? undefined}
          post={post}
        />
      )}
    </>
  );
}
