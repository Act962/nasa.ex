"use client";

import { SparklesIcon, CheckCircle2Icon, ClockIcon, CalendarIcon, BuildingIcon, XIcon, MegaphoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { EyeIcon, DownloadIcon } from "lucide-react";
import { POST_NETWORKS } from "../../constants";
import type { PlannerPost, PlannerPostPatch } from "../../hooks/use-nasa-planner";
import { downloadPlannerImageAsPng, getPlannerMediaUrl } from "../../lib/post-media";
import { PostMediaUploader } from "../post-media-uploader";
import { PostPreview } from "../post-preview";
import { PublishTargetPicker } from "../publish-target-picker";
import { POST_TYPE_LABELS } from "./post-type-options";

/** Detalhe do post aberto a partir do quadro: prévia, mídia, contas, anúncio, data e ações. */

interface BoardPostDialogProps {
  post: PlannerPost | null;
  isUpdating: boolean;
  isGenerating: boolean;
  onClose: () => void;
  onUpdate: (patch: PlannerPostPatch) => void;
  onGenerate: (postId: string) => void;
  onApprove: (postId: string) => void;
  onSchedule: (postId: string) => void;
  onViewImage: (imageUrl: string) => void;
}

export function BoardPostDialog({
  post, isUpdating, isGenerating, onClose, onUpdate, onGenerate, onApprove, onSchedule, onViewImage,
}: BoardPostDialogProps) {
  return (
    <Dialog open={!!post} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg max-h-[95vh] sm:max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 shrink-0">
          <DialogTitle className="line-clamp-1">{post?.title}</DialogTitle>
        </DialogHeader>
        {post && (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <PostPreview post={post} />
            {post.thumbnail ? (
              <div className="relative group rounded-lg overflow-hidden aspect-square w-full max-w-xs mx-auto bg-muted">
                <img
                  src={getPlannerMediaUrl(post.thumbnail)}
                  alt={post.title ?? "Post"}
                  className="w-full h-full object-cover"
                />
                {/* Overlay with view/download buttons */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="gap-1.5 shadow-lg"
                    onClick={() => onViewImage(getPlannerMediaUrl(post.thumbnail!))}
                  >
                    <EyeIcon className="size-4" />
                    Visualizar
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="gap-1.5 shadow-lg"
                    onClick={() => downloadPlannerImageAsPng(post.thumbnail!, post.title ?? undefined)}
                  >
                    <DownloadIcon className="size-4" />
                    Baixar PNG
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Media uploader — always visible */}
            <PostMediaUploader
              postId={post.id}
              postType={post.type ?? "STATIC"}
              hasImage={!!post.thumbnail}
              hasVideo={!!post.videoKey}
              thumbnailUrl={post.thumbnail}
              slides={post.slides ?? []}
            />

            {/* Action buttons below image */}
            {post.thumbnail && (
              <div className="flex gap-2 justify-center">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => onViewImage(getPlannerMediaUrl(post.thumbnail!))}
                >
                  <EyeIcon className="size-3.5" />
                  Visualizar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => downloadPlannerImageAsPng(post.thumbnail!, post.title ?? undefined)}
                >
                  <DownloadIcon className="size-3.5" />
                  Baixar PNG
                </Button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Badge>{post.status}</Badge>
              {post.type && <Badge variant="outline">{POST_TYPE_LABELS[post.type] ?? post.type}</Badge>}
              {(post.targetNetworks ?? []).map((net: string) => (
                <Badge key={net} variant="secondary">{POST_NETWORKS[net] ?? net}</Badge>
              ))}
            </div>
            {post.clientOrgName && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <BuildingIcon className="size-3.5" />{post.clientOrgName}
              </p>
            )}

            <PublishTargetPicker
              targetNetworks={post.targetNetworks ?? []}
              igAccountId={post.targetIgAccountId}
              fbPageId={post.targetFbPageId}
              disabled={isUpdating || post.status === "PUBLISHED"}
              onChange={(patch) =>
                onUpdate(patch)
              }
            />

            {/* Post para anúncio */}
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <Label className="flex items-center gap-1.5 cursor-pointer">
                <MegaphoneIcon className="size-3.5 text-warning" />
                Post para anúncio
              </Label>
              <Switch
                checked={post.isAd ?? false}
                onCheckedChange={(v) => onUpdate({ isAd: v })}
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
                  defaultValue={post.scheduledAt
                    ? new Date(post.scheduledAt).toISOString().slice(0, 16)
                    : ""}
                  key={post.id}
                  className="flex-1 text-sm"
                  onChange={(e) => {
                    onUpdate({ scheduledAt: e.target.value || undefined });
                  }}
                />
                {post.scheduledAt && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onUpdate({ scheduledAt: null })}
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
            {post.caption && (
              <div>
                <Label className="text-xs text-muted-foreground">Legenda</Label>
                <ScrollArea className="h-32 mt-1">
                  <p className="text-sm whitespace-pre-wrap">{post.caption}</p>
                </ScrollArea>
              </div>
            )}
            {post.hashtags?.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Hashtags</Label>
                <p className="text-sm text-info mt-1">
                  {Array.isArray(post.hashtags) ? post.hashtags.join(" ") : post.hashtags}
                </p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onGenerate(post.id)} disabled={isGenerating}>
                <SparklesIcon className="size-3.5" />
                {isGenerating ? "Gerando..." : "Gerar com IA"}
              </Button>
              {post.status === "PENDING_APPROVAL" && (
                <Button size="sm" className="gap-1.5" onClick={() => onApprove(post.id)}>
                  <CheckCircle2Icon className="size-3.5" />Aprovar
                </Button>
              )}
              {post.status === "APPROVED" && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onSchedule(post.id)}>
                  <ClockIcon className="size-3.5" />Agendar
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
